import { useCallback, useEffect, useRef } from "react";

import { createClient, Client } from "graphql-ws";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";

const NOTIFICATION_STREAM_SUBSCRIPTION = `
  subscription NotificationStream {
    notificationStream {
      msg
      title
      status
      entityId
      entityName
    }
  }
`;

export interface NotificationMessage {
  msg: string;
  title: string | null;
  status: string;
  entityId: string | null;
  entityName: string | null;
}

interface UseNotificationSubscriptionOptions {
  ikApi: InfraKitchenApi;
  enabled: boolean;
  onMessage: (data: NotificationMessage) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook that subscribes to real-time notifications via GraphQL subscriptions
 * using the `graphql-ws` protocol. Replaces the raw WebSocket approach with
 * a typed, spec-compliant transport.
 */
export function useNotificationSubscription({
  ikApi,
  enabled,
  onMessage,
  onError,
}: UseNotificationSubscriptionOptions): void {
  const clientRef = useRef<Client | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    clientRef.current?.dispose();
    clientRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/graphql`;

    const client = createClient({
      url,
      connectionParams: async () => {
        const token = await ikApi.getToken();
        return { token };
      },
      shouldRetry: () => true,
      retryAttempts: Infinity,
      retryWait: async (retries) => {
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      },
      lazy: false,
      on: {
        connected: () => {
          // Connection established
        },
      },
    });
    clientRef.current = client;

    const unsubscribe = client.subscribe(
      {
        query: NOTIFICATION_STREAM_SUBSCRIPTION,
      },
      {
        next: ({ data }) => {
          const notification = (
            data as { notificationStream?: NotificationMessage }
          )?.notificationStream;
          if (notification) {
            onMessageRef.current(notification);
          }
        },
        error: (err) => {
          onErrorRef.current?.(err);
        },
        complete: () => {
          // Subscription ended normally
        },
      },
    );
    unsubscribeRef.current = unsubscribe;

    return cleanup;
  }, [ikApi, enabled, cleanup]);
}
