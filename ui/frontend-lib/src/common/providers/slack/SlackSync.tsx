import { useCallback, useEffect, useState } from "react";

import SyncIcon from "@mui/icons-material/Sync";
import { Box, Button, CircularProgress, Tooltip } from "@mui/material";

import { SlackIcon } from "../../../icons/Icons";
import { useConfig } from "../../context/ConfigContext";
import { useEntityProvider } from "../../context/EntityContext";
import { notify, notifyError } from "../../hooks/useNotification";

import { SLACK_INTEGRATION_QUERY, MAP_SLACK_MUTATION } from "./graphql";

interface SlackSyncProps {
  userId: string;
  slackId?: string | null;
}

export const SlackSync = ({ userId, slackId }: SlackSyncProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [slackIntegrationId, setSlackIntegrationId] = useState<string | null>(
    null,
  );
  const [syncing, setSyncing] = useState(false);

  const hasSlackId = !!slackId;

  useEffect(() => {
    ikApi
      .graphqlRequest<{
        integrations: { id: string; integrationProvider: string }[];
      }>(SLACK_INTEGRATION_QUERY, {
        filter: { integration_provider: "slack" },
      })
      .then((res) => {
        if (res.integrations.length > 0) {
          setSlackIntegrationId(res.integrations[0].id);
        }
      })
      .catch(() => {
        // Slack integration not available
      });
  }, [ikApi]);

  const handleSyncSlack = useCallback(async () => {
    setSyncing(true);
    try {
      await ikApi.graphqlRequest(MAP_SLACK_MUTATION, {
        integrationId: slackIntegrationId,
        userId,
      });
      notify("Slack ID synced successfully", "success");
      refreshEntity?.();
    } catch (e) {
      notifyError(e);
    } finally {
      setSyncing(false);
    }
  }, [ikApi, slackIntegrationId, userId, refreshEntity]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <SlackIcon width={18} height={18} />
      {hasSlackId ? (
        <Tooltip title="Slack User ID">
          <span>{slackId}</span>
        </Tooltip>
      ) : slackIntegrationId ? (
        <Button
          size="small"
          variant="outlined"
          startIcon={
            syncing ? (
              <CircularProgress size={14} />
            ) : (
              <SyncIcon fontSize="small" />
            )
          }
          onClick={handleSyncSlack}
          disabled={syncing}
        >
          Sync Slack
        </Button>
      ) : (
        <span>Not linked</span>
      )}
    </Box>
  );
};
