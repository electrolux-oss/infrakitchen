import { useCallback, useEffect, useRef } from "react";

import { createClient, Client } from "graphql-ws";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";

const LOG_STREAM_SUBSCRIPTION = `
  subscription LogStream($entityName: String!, $entityId: String!) {
    logStream(entityName: $entityName, entityId: $entityId) {
      data
      level
    }
  }
`;

interface UseLogStreamSubscriptionOptions {
  ikApi: InfraKitchenApi;
  entityName: string;
  entityId: string;
  enabled: boolean;
  onMessage: (data: string) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook that subscribes to real-time log streaming via GraphQL subscriptions
 * using the `graphql-ws` protocol. Replaces the raw WebSocket approach with
 * a typed, spec-compliant transport.
 */
export function useLogStreamSubscription({
  ikApi,
  entityName,
  entityId,
  enabled,
  onMessage,
  onError,
}: UseLogStreamSubscriptionOptions): void {
  const clientRef = useRef<Client | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Keep callback refs stable to avoid re-subscribing on every render
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
    if (!enabled || !entityName || !entityId) {
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
        // Exponential backoff: 1s, 2s, 4s, … capped at 30s
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      },
      lazy: false,
      on: {
        connected: () => {
          // Connection established — client auto-sends connection_init
        },
      },
    });
    clientRef.current = client;

    const unsubscribe = client.subscribe(
      {
        query: LOG_STREAM_SUBSCRIPTION,
        variables: { entityName, entityId },
      },
      {
        next: ({ data }) => {
          const logData = (data as { logStream?: { data?: string } })?.logStream
            ?.data;
          if (logData !== undefined) {
            onMessageRef.current(logData);
          }
        },
        error: (err) => {
          onErrorRef.current?.(err);
        },
        complete: () => {
          // Subscription ended normally (server-side)
        },
      },
    );
    unsubscribeRef.current = unsubscribe;

    return cleanup;
  }, [ikApi, entityName, entityId, enabled, cleanup]);
}
