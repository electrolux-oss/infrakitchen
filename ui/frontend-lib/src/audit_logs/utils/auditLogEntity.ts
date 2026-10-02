import type { EntityRecord } from "../../common/components/entities/Entity";
import { ENTITY_ACTION } from "../../utils/constants";
import type { GqlAuditLog } from "../graphql";

export function getAuditLogEntity(
  log: Pick<GqlAuditLog, "action" | "entityData" | "metadata">,
): { entity?: EntityRecord; isDeleted: boolean } {
  if (log.entityData) {
    return { entity: log.entityData, isDeleted: false };
  }
  if (log.action === ENTITY_ACTION.DELETE && log.metadata) {
    return { entity: log.metadata as EntityRecord, isDeleted: true };
  }
  return { isDeleted: false };
}
