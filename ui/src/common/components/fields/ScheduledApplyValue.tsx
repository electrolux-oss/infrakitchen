import { GqlScheduledResourceAction } from "../../../resources/graphql";

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
      <p className="m-0 text-body2 font-medium text-warning">
        {getDateValue(scheduledAction.runAt)}
      </p>
      {scheduledAction.cron && (
        <span className="text-caption text-fg-muted">
          Repeats: <span className="font-mono">{scheduledAction.cron}</span> (
          {scheduledAction.timezone ?? "UTC"})
        </span>
      )}
    </>
  );
};
