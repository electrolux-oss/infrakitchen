import { useEffect, useState } from "react";

import {
  Box,
  Button,
  FormHelperText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  CANCEL_SCHEDULED_ENTITY_ACTION_MUTATION,
  GqlScheduledResourceAction,
} from "../../resources/graphql";
import { useConfig } from "../context/ConfigContext";
import { notify, notifyError } from "../hooks/useNotification";

import { getDateValue } from "./CommonField";
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

const entityLabel = (entityType: "resource" | "executor") =>
  entityType === "resource" ? "Resource" : "Executor";

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
  const isPast = Boolean(runAt) && new Date(runAt).getTime() <= Date.now();
  const canSubmit = Boolean(runAt) && !isPast && !isSaving && !isCancelling;

  const handleClose = () => {
    if (isSaving || isCancelling) return;
    setRunAt("");
    onClose();
  };

  const handleSchedule = async () => {
    if (!canSubmit) return;

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
          : `${entityLabel(entityType)} apply scheduled successfully`,
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
      title={scheduledAction ? "Reschedule Apply" : "Schedule Apply"}
      content={
        <Stack spacing={2} sx={{ pt: 1 }}>
          {scheduledAction && (
            <Typography
              variant="body2"
              sx={{ color: "warning.main", fontWeight: 500 }}
            >
              Currently scheduled for {getDateValue(scheduledAction.runAt)}.
            </Typography>
          )}
          <Typography variant="body2" color="textSecondary">
            Choose when to automatically run an apply on this {entityType}.
            Times are shown in your local time zone.
          </Typography>

          <Box>
            <Typography
              variant="caption"
              component="div"
              sx={{ fontWeight: 600, color: "text.secondary", mb: 1 }}
            >
              Pick a time
            </Typography>
            <TextField
              type="datetime-local"
              value={runAt}
              onChange={(event) => setRunAt(event.target.value)}
              slotProps={{
                htmlInput: { min: minRunAt },
              }}
              fullWidth
              autoFocus
              error={isPast}
            />
            {isPast ? (
              <FormHelperText error>
                Please choose a time in the future.
              </FormHelperText>
            ) : runAt ? (
              <FormHelperText>
                {entityLabel(entityType)} apply will be queued for{" "}
                {getDateValue(new Date(runAt))}.
              </FormHelperText>
            ) : null}
          </Box>
        </Stack>
      }
      actions={
        <>
          {scheduledAction && (
            <Button
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
            disabled={!canSubmit}
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
