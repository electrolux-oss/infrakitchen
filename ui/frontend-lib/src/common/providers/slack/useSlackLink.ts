import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../context/ConfigContext";
import { useEntityProvider } from "../../context/EntityContext";

import { MAP_SLACK_MUTATION, SLACK_INTEGRATION_QUERY } from "./graphql";

export interface SlackLinkState {
  isLinked: boolean;
  /** False only when the integrations could be listed and none is Slack. */
  integrationAvailable: boolean;
  linking: boolean;
  error: string | null;
  /** Resolves to the error message, or null when the account was linked. */
  link: () => Promise<string | null>;
}

const errorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message || "Linking the Slack account failed.";
};

/** Detects the Slack integration and links the user's InfraKitchen account to their Slack user. */
export const useSlackLink = (
  userId: string,
  slackId?: string | null,
): SlackLinkState => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [integrationAvailable, setIntegrationAvailable] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ikApi
      .graphqlRequest<{
        integrations: { id: string; integrationProvider: string }[];
      }>(SLACK_INTEGRATION_QUERY, {
        filter: { integration_provider: "slack" },
      })
      .then((res) => {
        setIntegrationId(res.integrations[0]?.id ?? null);
        setIntegrationAvailable(res.integrations.length > 0);
      })
      .catch(() => {
        // Users who can't list integrations may still link; the server picks the integration
        setIntegrationAvailable(true);
      });
  }, [ikApi]);

  const link = useCallback(async () => {
    setLinking(true);
    setError(null);
    try {
      await ikApi.graphqlRequest(MAP_SLACK_MUTATION, { integrationId, userId });
      refreshEntity?.();
      return null;
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      return message;
    } finally {
      setLinking(false);
    }
  }, [ikApi, integrationId, userId, refreshEntity]);

  return {
    isLinked: !!slackId,
    integrationAvailable,
    linking,
    error,
    link,
  };
};
