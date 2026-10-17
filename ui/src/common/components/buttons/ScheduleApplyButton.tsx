import { useState } from "react";

import { RepeatIcon, ScheduleIcon } from "../../../icons/material";
import { Button, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useEntityProvider } from "../../context/EntityContext";
import { useNow } from "../../hooks/useNow";
import { usePendingScheduledAction } from "../../hooks/usePendingScheduledAction";
import { formatTimeUntil } from "../../utils";
import { ScheduleEntityActionDialog } from "../dialogs/ScheduleEntityActionDialog";
import { getDateValue } from "../fields/CommonField";

export interface ScheduleApplyButtonProps {
  entityType: "resource" | "executor";
}

/**
 * "Schedule Apply" button for the page header toolbar, grouped with the other
 * run actions (Plan / Apply / …). Stays compact when a schedule is pending —
 * the label shows a live seconds-accurate countdown (e.g. "in 3h 25m 10s")
 * and the exact timestamp is available on hover — and owns the
 * schedule/reschedule/cancel dialog. Recurring (cron) schedules show a repeat
 * icon and count down to their next run; the tooltip adds the cron expression.
 */
export const ScheduleApplyButton = ({
  entityType,
}: ScheduleApplyButtonProps) => {
  const { entity, actions, refreshEntity } = useEntityProvider();
  const { pendingScheduledAction } = usePendingScheduledAction();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const now = useNow();

  if (!entity || !actions.includes("execute")) return null;
  if (entity?.abstract) return null;

  const cron = pendingScheduledAction?.cron ?? null;

  const button = (
    <Button
      color="inherit"
      startIcon={
        cron ? (
          <RepeatIcon />
        ) : (
          <ScheduleIcon
            className={cn(
              pendingScheduledAction &&
                "border-warning/45 bg-warning/12 text-warning hover:border-warning hover:bg-warning/20",
            )}
          />
        )
      }
      onClick={() => setIsDialogOpen(true)}
    >
      {" "}
      {pendingScheduledAction ? (
        <>
          {cron ? "Recurring (" : "Scheduled ("}
          {/* Countdown in the code font so digits stay uniform while ticking. */}
          <span className="font-mono">
            {formatTimeUntil(pendingScheduledAction.runAt, now)}
          </span>
          {")"}
        </>
      ) : (
        "Schedule Apply"
      )}
    </Button>
  );

  return (
    <>
      {pendingScheduledAction ? (
        <Tooltip
          title={
            cron
              ? `Next run ${getDateValue(pendingScheduledAction.runAt)} · ${cron} (${pendingScheduledAction.timezone ?? "UTC"})`
              : getDateValue(pendingScheduledAction.runAt)
          }
        >
          {button}
        </Tooltip>
      ) : (
        button
      )}
      <ScheduleEntityActionDialog
        open={isDialogOpen}
        entityId={String(entity.id)}
        entityType={entityType}
        scheduledAction={pendingScheduledAction}
        onClose={() => setIsDialogOpen(false)}
        onChanged={() => refreshEntity?.()}
      />
    </>
  );
};
