import type { EntityRecord } from "../../common/components/entities/Entity";
import type { UnresolvedEntityReason } from "../../common/components/entities/UnresolvedEntity";
import { ENTITY_ACTION } from "../../utils/constants";
import type { GqlAuditLog } from "../graphql";

export function getAuditLogEntity(
  log: Pick<
    GqlAuditLog,
    "action" | "entityData" | "metadata" | "entityLoaderMissing"
  >,
): {
  entity?: EntityRecord;
  isDeleted: boolean;
  unresolved: UnresolvedEntityReason | null;
} {
  if (log.entityData) {
    return { entity: log.entityData, isDeleted: false, unresolved: null };
  }
  if (log.entityLoaderMissing) {
    return { isDeleted: false, unresolved: "untracked" };
  }
  if (log.action === ENTITY_ACTION.DELETE && log.metadata) {
    return {
      entity: log.metadata as EntityRecord,
      isDeleted: true,
      unresolved: null,
    };
  }
  return { isDeleted: false, unresolved: "deleted" };
}
