import { useMemo } from "react";

import { GqlScheduledResourceAction } from "../../resources/graphql";
import { useEntityProvider } from "../context/EntityContext";

/**
 * Returns the earliest active scheduled action for the current entity, or
 * null when none is scheduled. A recurring (cron) schedule stays active
 * whatever the status of its last run.
 */
export const usePendingScheduledAction = () => {
  const { scheduledActions } = useEntityProvider();

  const pendingScheduledAction = useMemo<GqlScheduledResourceAction | null>(
    () =>
      scheduledActions
        .filter((action) => action.status === "PENDING" || action.cron)
        .sort(
          (left, right) =>
            new Date(left.runAt).getTime() - new Date(right.runAt).getTime(),
        )[0] ?? null,
    [scheduledActions],
  );

  return { pendingScheduledAction };
};
