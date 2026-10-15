import { useCallback, useEffect, useRef } from "react";

import { createClient, Client } from "graphql-ws";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";

const EVENT_STREAM_SUBSCRIPTION = `
  subscription EventStream {
    eventStream {
      event
      payload
      entityId
      entityName
      traceId
      auditLogId
    }
  }
`;

export interface EventStreamMessage {
  event: string;
  payload: Record<string, unknown>;
  entityId: string | null;
  entityName: string | null;
  traceId: string | null;
  auditLogId: string | null;
}

interface UseEventStreamSubscriptionOptions {
  ikApi: InfraKitchenApi;
  enabled: boolean;
  onMessage: (data: EventStreamMessage) => void;
  onError?: (error: unknown) => void;
}

export function useEventStreamSubscription({
  ikApi,
  enabled,
  onMessage,
  onError,
}: UseEventStreamSubscriptionOptions): void {
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
          // Connection established.
        },
      },
    });

    clientRef.current = client;

    const unsubscribe = client.subscribe(
      {
        query: EVENT_STREAM_SUBSCRIPTION,
      },
      {
        next: ({ data }) => {
          const eventStream = (data as { eventStream?: EventStreamMessage })
            ?.eventStream;
          if (eventStream) {
            onMessageRef.current(eventStream);
          }
        },
        error: (err) => {
          onErrorRef.current?.(err);
        },
        complete: () => {
          // Subscription ended normally.
        },
      },
    );
    unsubscribeRef.current = unsubscribe;

    return cleanup;
  }, [ikApi, enabled, cleanup]);
}
