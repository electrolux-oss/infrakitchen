import { useState } from "react";

import { useNavigate } from "react-router";

import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import EditIcon from "@mui/icons-material/Edit";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import RedoIcon from "@mui/icons-material/Redo";
import SyncIcon from "@mui/icons-material/Sync";
import UpdateIcon from "@mui/icons-material/Update";
import { Button, Tooltip } from "@mui/material";

import { ENTITY_ACTION } from "../../utils/constants";
import { buildEntityActionMutation } from "../graphql/entityActionMutation";
import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import { notify, notifyError } from "../hooks/useNotification";

import { ActionButton } from "./buttons/ActionButton";
import { CommonDialog } from "./CommonDialog";

export interface EntityActionsProps {
  entity_name: string;
  entity_id: string;
  showEditAction?: boolean;
}
export function EntityActions(props: EntityActionsProps) {
  const { entity_id, entity_name, showEditAction } = props;

  const { ikApi, linkPrefix } = useConfig();
  const { actions, refreshActions, refreshEntity } = useEntityProvider();
  const navigate = useNavigate();
  const [enabling, setEnabling] = useState(false);

  const [dialogValues, setDialogValues] = useState<{
    [key: string]: boolean;
  }>({
    approval: false,
    execute: false,
    sync: false,
    recreate: false,
    retry: false,
    dryrun: false,
    dryrun_with_temp_state: false,
  });

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await ikApi.graphqlRequest(buildEntityActionMutation(entity_name), {
        id: entity_id,
        input: { action: ENTITY_ACTION.ENABLE },
      });
      notify("Entity enabled", "success");
      // Refresh actions and the entity so header/status buttons flip (a
      // disabled entity becomes enabled).
      if (refreshActions) refreshActions();
      if (refreshEntity) refreshEntity();
    } catch (error) {
      notifyError(error);
    } finally {
      setEnabling(false);
    }
  };

  const changeDialog = async (dialog: string) => {
    setDialogValues((dialogValues) => {
      return { ...dialogValues, [dialog]: !dialogValues[dialog] as boolean };
    });
  };

  const changeDialogWithRefresh = async (dialog: string) => {
    changeDialog(dialog);
    // Actions drive which header buttons show (e.g. Enable for a disabled
    // entity), so refresh both the action list and the entity itself — only
    // refreshing actions leaves entity.status stale.
    if (refreshActions) refreshActions();
    if (refreshEntity) refreshEntity();
  };

  return (
    <>
      {actions.includes("dryrun") && (
        <Tooltip title="Preview what will change before applying">
          <Button
            onClick={() => changeDialog("dryrun")}
            startIcon={<ContentPasteIcon />}
          >
            Plan
          </Button>
        </Tooltip>
      )}
      {actions.includes("dryrun") &&
        actions.includes("has_temporary_state") && (
          <Button
            onClick={() => changeDialog("dryrun_with_temp_state")}
            startIcon={<PendingActionsIcon />}
          >
            Plan (Temp State)
          </Button>
        )}
      {actions.includes("execute") && (
        <Tooltip title="Apply changes to infrastructure">
          <Button
            onClick={() => changeDialog("execute")}
            startIcon={<UpdateIcon />}
          >
            Apply
          </Button>
        </Tooltip>
      )}
      {actions.includes("retry") && (
        <Button onClick={() => changeDialog("retry")}>Retry</Button>
      )}

      {actions.includes("sync") && (
        <Button onClick={() => changeDialog("sync")} startIcon={<SyncIcon />}>
          Sync
        </Button>
      )}

      {actions.includes("recreate") && (
        <Button
          onClick={() => changeDialog("recreate")}
          startIcon={<RedoIcon />}
        >
          Recreate
        </Button>
      )}
      {actions.includes("enable") && (
        <Button onClick={() => void handleEnable()} disabled={enabling}>
          {enabling ? "Enabling..." : "Enable"}
        </Button>
      )}
      {actions.includes("edit") && showEditAction && (
        <Tooltip title="Edit configuration">
          <Button
            onClick={() =>
              navigate(`${linkPrefix}${entity_name}s/${entity_id}/edit`)
            }
            sx={{ minWidth: 0, px: 1 }}
          >
            <EditIcon />
          </Button>
        </Tooltip>
      )}
      <CommonDialog
        title="Confirmation"
        content="This will apply the changes. Do you want to continue?"
        maxWidth="xs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.EXECUTE}
            onSubmit={() => changeDialog("execute")}
            color="error"
            variant="contained"
          >
            Apply
          </ActionButton>
        }
        open={dialogValues.execute}
        onClose={() => changeDialog("execute")}
      />

      <CommonDialog
        title="Request Retry"
        content="Do you want to execute it again?"
        maxWidth="xs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.RETRY}
            onSubmit={() => changeDialog("retry")}
            color="error"
            variant="contained"
          >
            Retry
          </ActionButton>
        }
        open={dialogValues.retry}
        onClose={() => changeDialog("retry")}
      />

      <CommonDialog
        title="Sync Repository"
        content="This will synchronize repository tags and branches. Do you want to continue?"
        maxWidth="xs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.SYNC}
            onSubmit={() => changeDialog("sync")}
          >
            Sync
          </ActionButton>
        }
        open={dialogValues.sync}
        onClose={() => changeDialog("sync")}
      />

      <CommonDialog
        title="Confirmation"
        content="This will create an execution plan to preview the changes. Do you want to continue?"
        maxWidth="xs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.DRYRUN}
            onSubmit={() => changeDialog("dryrun")}
          >
            Plan
          </ActionButton>
        }
        open={dialogValues.dryrun}
        onClose={() => changeDialog("dryrun")}
      />
      <CommonDialog
        title="Confirmation"
        content="This will create an execution plan to preview the changes with temporary state. Do you want to continue?"
        maxWidth="xs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.DRYRUN_WITH_TEMP_STATE}
            onSubmit={() => changeDialog("dryrun_with_temp_state")}
          >
            Plan
          </ActionButton>
        }
        open={dialogValues.dryrun_with_temp_state}
        onClose={() => changeDialog("dryrun_with_temp_state")}
      />

      <CommonDialog
        title="Request recreate"
        content="Recreate will return entity back. Do you want to approve the request?"
        maxWidth="xs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.RECREATE}
            onSubmit={() => changeDialogWithRefresh("recreate")}
          >
            Recreate
          </ActionButton>
        }
        open={dialogValues.recreate}
        onClose={() => changeDialog("recreate")}
      />
    </>
  );
}

export default EntityActions;
