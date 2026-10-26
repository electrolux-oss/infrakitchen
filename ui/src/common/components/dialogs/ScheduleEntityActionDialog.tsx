import { useEffect, useState } from "react";

import {
  CANCEL_SCHEDULED_ENTITY_ACTION_MUTATION,
  GqlScheduledResourceAction,
} from "../../../resources/graphql";
import {
  Button,
  FormHelperText,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "../../../ui";
import { useConfig } from "../../context/ConfigContext";
import { notify, notifyError } from "../../hooks/useNotification";
import { useNow } from "../../hooks/useNow";
import { CODE_FONT_FAMILY } from "../../theme";
import { getDateValue } from "../fields/CommonField";

import { CommonDialog } from "./CommonDialog";

const SCHEDULE_ENTITY_ACTION_MUTATION = `
  mutation ScheduleEntityAction($input: ScheduledEntityActionCreateInput!) {
    scheduleEntityAction(input: $input) {
      id
      entityId
      entity
      action
      runAt
      cron
      timezone
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

type ScheduleMode = "once" | "recurring";

const CUSTOM_PRESET = "custom";

const CRON_PRESETS = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day at 02:00", cron: "0 2 * * *" },
  { label: "Every Monday at 02:00", cron: "0 2 * * 1" },
  { label: "1st of every month at 02:00", cron: "0 2 1 * *" },
];

const DEFAULT_CRON = CRON_PRESETS[1].cron;

const presetForCron = (cron: string) =>
  CRON_PRESETS.find((preset) => preset.cron === cron.trim())?.cron ??
  CUSTOM_PRESET;

const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function ScheduleEntityActionDialog({
  open,
  entityId,
  entityType,
  scheduledAction,
  onClose,
  onChanged,
}: ScheduleEntityActionDialogProps) {
  const { ikApi } = useConfig();
  const [mode, setMode] = useState<ScheduleMode>("once");
  const [runAt, setRunAt] = useState("");
  const [cron, setCron] = useState(DEFAULT_CRON);
  const [preset, setPreset] = useState(DEFAULT_CRON);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!open) return;
    const existingCron = scheduledAction?.cron ?? null;
    setMode(existingCron ? "recurring" : "once");
    setCron(existingCron ?? DEFAULT_CRON);
    setPreset(presetForCron(existingCron ?? DEFAULT_CRON));
    setRunAt(
      scheduledAction && !existingCron
        ? formatDateTimeLocal(new Date(scheduledAction.runAt))
        : "",
    );
  }, [open, scheduledAction]);

  // Recurring schedules are always saved with the viewer's zone; an existing
  // schedule keeps showing the zone it was created in until it is saved again.
  const timeZone = browserTimeZone();

  const now = useNow();
  const minRunAt = formatDateTimeLocal(new Date(now));
  const isPast = Boolean(runAt) && new Date(runAt).getTime() <= now;
  const isRecurring = mode === "recurring";
  const hasValue = isRecurring
    ? Boolean(cron.trim())
    : Boolean(runAt) && !isPast;
  const canSubmit = hasValue && !isSaving && !isCancelling;

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
          ...(isRecurring
            ? { cron: cron.trim(), timezone: timeZone }
            : { runAt: new Date(runAt).toISOString() }),
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
      notify("Schedule cancelled", "success");
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
        <div className="flex flex-col gap-4 pt-2">
          {scheduledAction && (
            <p className="m-0 text-body2 font-medium text-warning">
              {scheduledAction.cron ? (
                <>
                  Repeats{" "}
                  <span className="font-mono">{scheduledAction.cron}</span> (
                  {scheduledAction.timezone ?? "UTC"}), next run{" "}
                  {getDateValue(scheduledAction.runAt)}.
                </>
              ) : (
                <>
                  Currently scheduled for {getDateValue(scheduledAction.runAt)}.
                </>
              )}
            </p>
          )}
          <ToggleButtonGroup
            value={mode}
            exclusive
            size="small"
            fullWidth
            onChange={(_, value: ScheduleMode | null) =>
              value && setMode(value)
            }
          >
            <ToggleButton value="once">One-time</ToggleButton>
            <ToggleButton value="recurring">Recurring</ToggleButton>
          </ToggleButtonGroup>

          {isRecurring ? (
            <>
              <p className="m-0 text-body2 text-fg-muted">
                Run an apply on this {entityType} repeatedly on a cron schedule.
                A run is skipped if the previous one is still in progress.
              </p>
              <TextField
                select
                label="Repeat"
                value={preset}
                onChange={(event) => {
                  setPreset(event.target.value);
                  if (event.target.value !== CUSTOM_PRESET) {
                    setCron(event.target.value);
                  }
                }}
                fullWidth
              >
                {CRON_PRESETS.map((option) => (
                  <MenuItem key={option.cron} value={option.cron}>
                    {option.label}
                  </MenuItem>
                ))}
                <MenuItem value={CUSTOM_PRESET}>
                  Custom cron expression
                </MenuItem>
              </TextField>
              <div>
                <TextField
                  label="Cron expression"
                  value={cron}
                  onChange={(event) => {
                    setCron(event.target.value);
                    setPreset(presetForCron(event.target.value));
                  }}
                  placeholder="0 2 * * *"
                  fullWidth
                  inputProps={{ style: { fontFamily: CODE_FONT_FAMILY } }}
                />
                <FormHelperText>
                  minute hour day-of-month month day-of-week, evaluated in{" "}
                  {timeZone}.
                </FormHelperText>
              </div>
            </>
          ) : (
            <>
              <p className="m-0 text-body2 text-fg-muted">
                Choose when to automatically run an apply on this {entityType}.
                Times are shown in your local time zone.
              </p>

              <div>
                <div className="m-0 mb-2 text-caption font-semibold text-fg-muted">
                  Pick a time
                </div>
                <TextField
                  type="datetime-local"
                  value={runAt}
                  onChange={(event) => setRunAt(event.target.value)}
                  inputProps={{ min: minRunAt }}
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
              </div>
            </>
          )}
        </div>
      }
      actions={
        <>
          {scheduledAction && (
            <Button
              color="error"
              onClick={() => void handleCancelSchedule()}
              disabled={isSaving || isCancelling}
            >
              Cancel Schedule
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
