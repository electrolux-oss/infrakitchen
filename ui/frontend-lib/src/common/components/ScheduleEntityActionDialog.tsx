import { useEffect, useState } from "react";

import { Button, Stack, TextField, Typography } from "@mui/material";

import {
  CANCEL_SCHEDULED_ENTITY_ACTION_MUTATION,
  GqlScheduledResourceAction,
} from "../../resources/graphql";
import { useConfig } from "../context/ConfigContext";
import { notify, notifyError } from "../hooks/useNotification";

import { CommonDialog } from "./CommonDialog";

const SCHEDULE_ENTITY_ACTION_MUTATION = `
  mutation ScheduleEntityAction($input: ScheduledEntityActionCreateInput!) {
    scheduleEntityAction(input: $input) {
      id
      entityId
      entity
      action
      runAt
      status
      error
      createdAt
    }
  }
`;

interface ScheduleEntityActionDialogProps {
  open: boolean;
  entityId: string;
  entityType: "resource" | "executor";
  scheduledAction?: GqlScheduledResourceAction | null;
  onClose: () => void;
  onChanged?: () => void;
}

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function ScheduleEntityActionDialog({
  open,
  entityId,
  entityType,
  scheduledAction,
  onClose,
  onChanged,
}: ScheduleEntityActionDialogProps) {
  const { ikApi } = useConfig();
  const [runAt, setRunAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRunAt(
      scheduledAction
        ? formatDateTimeLocal(new Date(scheduledAction.runAt))
        : "",
    );
  }, [open, scheduledAction]);

  const minRunAt = formatDateTimeLocal(new Date());

  const handleClose = () => {
    if (isSaving || isCancelling) return;
    setRunAt("");
    onClose();
  };

  const handleSchedule = async () => {
    if (!runAt) return;

    setIsSaving(true);
    try {
      await ikApi.graphqlRequest(SCHEDULE_ENTITY_ACTION_MUTATION, {
        input: {
          entityId,
          entity: entityType,
          action: "execute",
          runAt: new Date(runAt).toISOString(),
        },
      });
      notify(
        scheduledAction
          ? "Scheduled apply updated successfully"
          : `${entityType === "resource" ? "Resource" : "Executor"} apply scheduled successfully`,
        "success",
      );
      onChanged?.();
      setRunAt("");
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!scheduledAction) return;

    setIsCancelling(true);
    try {
      await ikApi.graphqlRequest(CANCEL_SCHEDULED_ENTITY_ACTION_MUTATION, {
        id: scheduledAction.id,
      });
      notify("Scheduled apply cancelled", "success");
      onChanged?.();
      setRunAt("");
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <CommonDialog
      title="Schedule Apply"
      content={
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Pick when this {entityType} should be queued for apply.
          </Typography>
          <TextField
            label="Run at"
            type="datetime-local"
            value={runAt}
            onChange={(event) => setRunAt(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: minRunAt },
            }}
            fullWidth
            autoFocus
          />
        </Stack>
      }
      actions={
        <>
          {scheduledAction && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => void handleCancelSchedule()}
              disabled={isSaving || isCancelling}
            >
              Cancel Scheduled Apply
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => void handleSchedule()}
            disabled={!runAt || isSaving || isCancelling}
          >
            {scheduledAction ? "Save" : "Schedule"}
          </Button>
        </>
      }
      open={open}
      onClose={handleClose}
      maxWidth="xs"
    />
  );
}

export default ScheduleEntityActionDialog;
