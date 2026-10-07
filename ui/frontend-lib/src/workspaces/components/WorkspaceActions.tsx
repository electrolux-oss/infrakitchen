import { useState } from "react";

import SyncIcon from "@mui/icons-material/Sync";
import { Button, Tooltip } from "@mui/material";

import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { GqlWorkspace, SYNC_WORKSPACE_METADATA_MUTATION } from "../graphql";

/**
 * Page-header action buttons for the Workspace Details page, rendered
 * alongside the generic entity actions (Plan/Apply/etc.) in EntityContainer.
 * Currently only exposes "Sync" for GitHub workspaces, re-fetching repo
 * metadata (default branch, description, URLs) immediately on click.
 */
export const WorkspaceActions = () => {
  const { ikApi } = useConfig();
  const { entity, refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:workspace", "write");
  const [isSyncing, setIsSyncing] = useState(false);

  const workspace = entity as GqlWorkspace | undefined;
  if (!workspace || workspace.workspaceProvider !== "github") return null;

  const handleSync = () => {
    setIsSyncing(true);
    ikApi
      .graphqlRequest(SYNC_WORKSPACE_METADATA_MUTATION, { id: workspace.id })
      .then(() => {
        notify("Workspace metadata synced successfully", "success");
        refreshEntity?.();
      })
      .catch((error) => {
        notifyError(error);
      })
      .finally(() => {
        setIsSyncing(false);
      });
  };

  return (
    <Tooltip title="Sync repository metadata from GitHub">
      <span>
        <Button
          onClick={handleSync}
          startIcon={<SyncIcon />}
          disabled={isSyncing || !canEdit}
        >
          {isSyncing ? "Syncing..." : "Sync"}
        </Button>
      </span>
    </Tooltip>
  );
};

export default WorkspaceActions;
