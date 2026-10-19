import { Label } from "../../../ui/Label";
import { cn } from "../../../utils/cn";
import { useEntityProvider } from "../../context/EntityContext";

import { StatusLabel } from "./StatusLabel";

export interface EntityStatusChipProps {
  status: string;
  state?: string;
  className?: string;
}

/**
 * Page-header status as a Label pill: the exact same `STATE [STATUS]` text
 * (uppercase, status-colored) the sidebar used to render, plus an explicit
 * marker when temporary-state changes are saved but not yet applied. Reads
 * pending changes from the surrounding EntityProvider, so it works on any
 * entity page.
 */
export const EntityStatusChip = ({
  status,
  state,
  className,
}: EntityStatusChipProps) => {
  const { pendingChanges } = useEntityProvider();
  const pendingCount = pendingChanges ? Object.keys(pendingChanges).length : 0;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <StatusLabel status={status} state={state} size="large" />
      {pendingCount > 0 && (
        <Label
          size="large"
          tone="warning"
          label={`${pendingCount} change${pendingCount === 1 ? "" : "s"} pending`}
        />
      )}
    </span>
  );
};

export default EntityStatusChip;
