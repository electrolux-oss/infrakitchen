import { useState } from "react";

import ScheduleIcon from "@mui/icons-material/Schedule";
import { Box, Button, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { CODE_FONT_FAMILY } from "../theme";
import { useEntityProvider } from "../context/EntityContext";
import { usePendingScheduledAction } from "../hooks/usePendingScheduledAction";
import { useNow } from "../hooks/useNow";
import { formatTimeUntil } from "../utils";

import { getDateValue } from "./CommonField";
import { ScheduleEntityActionDialog } from "./ScheduleEntityActionDialog";

export interface ScheduleApplyButtonProps {
  entityType: "resource" | "executor";
}

/**
 * "Schedule Apply" button for the page header toolbar, grouped with the other
 * run actions (Plan / Apply / …). Stays compact when a schedule is pending —
 * the label shows a live seconds-accurate countdown (e.g. "in 3h 25m 10s")
 * and the exact timestamp is available on hover — and owns the
 * schedule/reschedule/cancel dialog.
 */
export const ScheduleApplyButton = ({
  entityType,
}: ScheduleApplyButtonProps) => {
  const { entity, actions, refreshEntity } = useEntityProvider();
  const { pendingScheduledAction } = usePendingScheduledAction();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const now = useNow();

  if (!entity || !actions.includes("execute")) return null;

  const button = (
    <Button
      color="inherit"
      startIcon={<ScheduleIcon />}
      onClick={() => setIsDialogOpen(true)}
      sx={
        pendingScheduledAction
          ? (theme) => ({
              // Soft amber tint: same warning family as the status semantics,
              // but calm enough to read as "scheduled" rather than "alert".
              color: theme.palette.warning.main,
              borderColor: alpha(theme.palette.warning.main, 0.45),
              backgroundColor: alpha(theme.palette.warning.main, 0.12),
              "&:hover": {
                backgroundColor: alpha(theme.palette.warning.main, 0.2),
                borderColor: theme.palette.warning.main,
              },
            })
          : undefined
      }
    >
      {" "}
      {pendingScheduledAction ? (
        <>
          {"Scheduled ("}
          {/* Countdown in the code font so digits stay uniform while ticking. */}
          <Box component="span" sx={{ fontFamily: CODE_FONT_FAMILY }}>
            {formatTimeUntil(pendingScheduledAction.runAt, now)}
          </Box>
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
        <Tooltip title={getDateValue(pendingScheduledAction.runAt)}>
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

export default ScheduleApplyButton;
