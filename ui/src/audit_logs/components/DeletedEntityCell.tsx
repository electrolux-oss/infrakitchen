import { humanizeEntityType } from "../../common/components/entities/Entity";
import { Label } from "../../ui/Label";
import type { UnresolvedEntityReason } from "../utils/auditLogEntity";

const RESOLUTION_LABELS: Record<UnresolvedEntityReason, string> = {
  deleted: "[Deleted]",
  untracked: "[No detail available]",
};

/**
 * Cell for permission-denial rows: the request was rejected at the gate, so
 * no concrete entity was ever touched and there is no ID to show.
 */
export const DeniedEntityCell = ({
  entityType,
  action,
}: {
  entityType: string;
  action?: string;
}) => (
  <p className="m-0 text-body2 text-error">
    {action ? `${action.charAt(0).toUpperCase()}${action.slice(1)} ` : ""}
    {humanizeEntityType(entityType)} request was denied
  </p>
);

/**
 * Cell for audit rows whose backing entity cannot be resolved.
 *
 * "deleted" — the row is gone from the database.
 * "untracked" — the model type simply has no server-side detail loader;
 * the entity itself is probably still there.
 */
export const DeletedEntityCell = ({
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
        <Label size="small" label={humanizeEntityType(entityType)} />
      </div>
    )}
  </div>
);
