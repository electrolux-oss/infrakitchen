import { Label } from "../../../ui/Label";

import { humanizeEntityType } from "./Entity";
import { entityIcons } from "./entityIcons";

export type UnresolvedEntityReason = "deleted" | "untracked";

const RESOLUTION_LABELS: Record<UnresolvedEntityReason, string> = {
  deleted: "[Deleted]",
  untracked: "[No detail available]",
};

/**
 * Placeholder for a referenced entity that cannot be resolved.
 *
 * "deleted" — the row is gone from the database.
 * "untracked" — the model type simply has no server-side detail loader;
 * the entity itself is probably still there.
 */
export const UnresolvedEntity = ({
  entityId,
  entityType,
  reason,
}: {
  entityId: string;
  entityType: string;
  reason: UnresolvedEntityReason;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <p className="m-0 text-body2 text-fg-muted">{RESOLUTION_LABELS[reason]}</p>
    {entityId && (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="font-mono text-caption break-all text-fg-muted">
          {entityId}
        </span>
        <Label
          size="small"
          label={humanizeEntityType(entityType)}
          icon={entityIcons[entityType]}
        />
      </div>
    )}
  </div>
);
