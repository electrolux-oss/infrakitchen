import { useNavigate } from "react-router";

import { Alert, Spinner, Button } from "../../../ui";
import { useConfig } from "../../context/ConfigContext";
import { usePermissionProvider } from "../../context/PermissionContext";
import { notify } from "../../hooks/useNotification";

import { SlackLinkState } from "./useSlackLink";

interface SlackLinkHintProps {
  userId: string;
  slackLink: SlackLinkState;
  /** Extra sentence shown while the account is not linked. */
  pendingNote?: string;
}

/** Explains what is missing before Slack notifications can be delivered; renders nothing once linked. */
export const SlackLinkHint = ({
  userId,
  slackLink,
  pendingNote,
}: SlackLinkHintProps) => {
  const { linkPrefix, currentUser } = useConfig();
  const { permissions } = usePermissionProvider();
  const navigate = useNavigate();
  const { isLinked, integrationAvailable, linking, error, link } = slackLink;

  if (isLinked) {
    return null;
  }

  if (!integrationAvailable) {
    const integrationPermission = permissions["api:integration"];
    const canSetUp =
      permissions["*"] === "admin" ||
      integrationPermission === "write" ||
      integrationPermission === "admin";
    return (
      <Alert
        severity="info"
        action={
          canSetUp && (
            <Button
              className="whitespace-nowrap"
              color="inherit"
              size="small"
              onClick={() => navigate(`${linkPrefix}integrations/slack/setup`)}
            >
              Set up Slack
            </Button>
          )
        }
      >
        Slack isn&apos;t set up in InfraKitchen yet.
        {!canSetUp && " Ask an administrator to add a Slack integration."}
      </Alert>
    );
  }

  const isOwnAccount = currentUser?.id === userId;
  const handleLink = async () => {
    if (!(await link())) {
      notify("Slack account linked", "success");
    }
  };

  return (
    <Alert
      severity={error ? "warning" : "info"}
      action={
        <Button
          className="whitespace-nowrap"
          color="inherit"
          size="small"
          onClick={handleLink}
          disabled={linking}
          startIcon={linking ? <Spinner size={14} /> : undefined}
        >
          Link Slack account
        </Button>
      }
    >
      {isOwnAccount
        ? "Link your Slack account to receive Slack notifications."
        : "Link this user's Slack account to deliver Slack notifications."}
      {pendingNote && ` ${pendingNote}`}
      {error && <span className="mt-1 block text-caption">{error}</span>}
    </Alert>
  );
};
