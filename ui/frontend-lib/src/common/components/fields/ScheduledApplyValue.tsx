import { Box, Typography } from "@mui/material";

import { GqlScheduledResourceAction } from "../../../resources/graphql";
import { CODE_FONT_FAMILY } from "../../theme";

import { getDateValue } from "./CommonField";

export interface ScheduledApplyValueProps {
  scheduledAction: GqlScheduledResourceAction | null;
}

/**
 * Value for the "Next Scheduled Apply" overview field: the next run time and,
 * for recurring schedules, the cron expression with its time zone.
 */
export const ScheduledApplyValue = ({
  scheduledAction,
}: ScheduledApplyValueProps) => {
  if (!scheduledAction) return null;

  return (
    <>
      <Typography
        variant="body2"
        sx={{ color: "warning.main", fontWeight: 500 }}
      >
        {getDateValue(scheduledAction.runAt)}
      </Typography>
      {scheduledAction.cron && (
        <Typography variant="caption" color="textSecondary">
          Repeats:{" "}
          <Box component="span" sx={{ fontFamily: CODE_FONT_FAMILY }}>
            {scheduledAction.cron}
          </Box>{" "}
          ({scheduledAction.timezone ?? "UTC"})
        </Typography>
      )}
    </>
  );
};

export default ScheduledApplyValue;
