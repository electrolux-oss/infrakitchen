import { SlackIcon } from "../../../icons/Icons";
import { SyncIcon } from "../../../icons/material";
import { Spinner, Button, Tooltip } from "../../../ui";
import { notify, notifyError } from "../../hooks/useNotification";

import { useSlackLink } from "./useSlackLink";

interface SlackSyncProps {
  userId: string;
  slackId?: string | null;
}

export const SlackSync = ({ userId, slackId }: SlackSyncProps) => {
  const { isLinked, integrationAvailable, linking, link } = useSlackLink(
    userId,
    slackId,
  );

  const handleSyncSlack = async () => {
    const error = await link();
    if (error) {
      notifyError(new Error(error));
    } else {
      notify("Slack ID synced successfully", "success");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <SlackIcon width={18} height={18} />
      {isLinked ? (
        <Tooltip title="Slack User ID">
          <span>{slackId}</span>
        </Tooltip>
      ) : integrationAvailable ? (
        <Button
          startIcon={
            linking ? <Spinner size={14} /> : <SyncIcon fontSize="small" />
          }
          onClick={handleSyncSlack}
          disabled={linking}
        >
          Sync Slack
        </Button>
      ) : (
        <span>Not linked</span>
      )}
    </div>
  );
};
