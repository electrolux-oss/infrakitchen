import { useState } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";

import { ENTITY_ACTION } from "../../utils/constants";
import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import { notifyError } from "../hooks/useNotification";

import { ActionButton } from "./buttons/ActionButton";
import { CommonDialog } from "./CommonDialog";

export interface EntityActionsProps {
  entity_name: string;
  entity_id: string;
}
export function EntityActions(props: EntityActionsProps) {
  const { entity_id, entity_name } = props;

  const { linkPrefix, ikApi } = useConfig();
  const { actions } = useEntityProvider();
  const navigate = useNavigate();

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
    enable: false,
  });

  const [isLoading, setIsLoading] = useState(false);

  const changeDialog = async (dialog: string) => {
    setDialogValues((dialogValues) => {
      return { ...dialogValues, [dialog]: !dialogValues[dialog] as boolean };
    });
  };

  const handleDownloadClick = async () => {
    if (!entity_id) return;
    setIsLoading(true);

    await ikApi
      .downloadFile(`resources/${entity_id}/download`)
      .then((response) => {
        const blob = new Blob([response], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `debug.zip`;
        link.href = url;
        link.click();
      })
      .catch((e) => {
        notifyError(e);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <>
      <Button
        variant="outlined"
        onClick={() =>
          navigate(`${linkPrefix}${entity_name}s/${entity_id}/activity`, {
            state: {
              entityName: entity_name,
            },
          })
        }
      >
        Activity
      </Button>
      {actions.includes("dryrun") && (
        <Button
          variant="outlined"
          onClick={() => changeDialog("dryrun")}
          disabled={isLoading}
        >
          Plan
        </Button>
      )}
      {actions.includes("dryrun") &&
        actions.includes("has_temporary_state") && (
          <Button
            variant="outlined"
            onClick={() => changeDialog("dryrun_with_temp_state")}
            disabled={isLoading}
          >
            Plan (Temp State)
          </Button>
        )}
      {actions.includes("execute") && (
        <Button
          variant="contained"
          onClick={() => changeDialog("execute")}
          disabled={isLoading}
        >
          Execute
        </Button>
      )}
      {actions.includes("retry") && (
        <Button
          variant="contained"
          onClick={() => changeDialog("retry")}
          disabled={isLoading}
        >
          Retry
        </Button>
      )}

      {actions.includes("sync") && (
        <Button
          variant="contained"
          onClick={() => changeDialog("sync")}
          disabled={isLoading}
        >
          Sync
        </Button>
      )}

      {actions.includes("download") && (
        <Button
          variant="outlined"
          onClick={() => handleDownloadClick()}
          disabled={isLoading}
        >
          Source Code
        </Button>
      )}
      {actions.includes("recreate") && (
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => changeDialog("recreate")}
          disabled={isLoading}
        >
          Re-create
        </Button>
      )}
      {actions.includes("enable") && (
        <Button
          variant="outlined"
          color="success"
          onClick={() => changeDialog("enable")}
          disabled={isLoading}
        >
          Enable
        </Button>
      )}
      {actions.includes("edit") && (
        <Button
          variant="outlined"
          onClick={() =>
            navigate(`${linkPrefix}${entity_name}s/${entity_id}/edit`)
          }
        >
          Edit
        </Button>
      )}

      <CommonDialog
        title="Request Execution"
        content="Do you want to execute it?"
        actions={
          <ActionButton
            action={ENTITY_ACTION.EXECUTE}
            onSubmit={() => changeDialog("execute")}
            color="error"
            variant="contained"
          >
            Execute
          </ActionButton>
        }
        open={dialogValues.execute}
        onClose={() => changeDialog("execute")}
      />

      <CommonDialog
        title="Request Retry"
        content="Do you want to execute it again?"
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
        title="Request Sync"
        content="Do you want to sync it?"
        actions={
          <ActionButton
            action={ENTITY_ACTION.SYNC}
            onSubmit={() => changeDialog("sync")}
            color="error"
            variant="contained"
          >
            Sync
          </ActionButton>
        }
        open={dialogValues.sync}
        onClose={() => changeDialog("sync")}
      />

      <CommonDialog
        title="Request Dry-run"
        content="Dry-run will not change entities, it only provides the logs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.DRYRUN}
            onSubmit={() => changeDialog("dryrun")}
            color="success"
            variant="contained"
          >
            Run
          </ActionButton>
        }
        open={dialogValues.dryrun}
        onClose={() => changeDialog("dryrun")}
      />
      <CommonDialog
        title="Request Dry-run with Temp State"
        content="Dry-run will not change entities, it only provides the logs"
        actions={
          <ActionButton
            action={ENTITY_ACTION.DRYRUN_WITH_TEMP_STATE}
            onSubmit={() => changeDialog("dryrun_with_temp_state")}
            color="success"
            variant="contained"
          >
            Run with Temp State
          </ActionButton>
        }
        open={dialogValues.dryrun_with_temp_state}
        onClose={() => changeDialog("dryrun_with_temp_state")}
      />

      <CommonDialog
        title="Request re-create"
        content="Re-create will return entity back. Do you want to approve the request?"
        actions={
          <ActionButton
            action={ENTITY_ACTION.RECREATE}
            onSubmit={() => changeDialog("recreate")}
          >
            Recreate
          </ActionButton>
        }
        open={dialogValues.recreate}
        onClose={() => changeDialog("recreate")}
      />
      <CommonDialog
        title="Request Enable"
        content="Do you want to enable this entity?"
        actions={
          <ActionButton
            action={ENTITY_ACTION.ENABLE}
            onSubmit={() => changeDialog("enable")}
          >
            Enable
          </ActionButton>
        }
        open={dialogValues.enable}
        onClose={() => changeDialog("enable")}
      />
    </>
  );
}

export default EntityActions;
