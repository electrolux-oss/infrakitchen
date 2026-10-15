import { Entity, EntityRecord } from "../entities/Entity";
import { CommonField } from "../fields/CommonField";
import { RelativeTime } from "../fields/RelativeTime";

import { SidebarSection } from "./EntitySidebar";

export interface SidebarDetailsEntity {
  creator?: EntityRecord | null;
  createdAt: string | Date;
  /** Omit when the entity is never updated; null shows a placeholder. */
  updatedAt?: string | Date | null;
  revisionNumber?: number | null;
}

export interface SidebarDetailsSectionProps {
  entity: SidebarDetailsEntity;
  /** Label for the creator field. */
  creatorLabel?: string;
}

/**
 * "Details" sidebar section shared by entity detail pages: who created the
 * entity, when it was created and last updated, and its revision.
 */
export const SidebarDetailsSection = ({
  entity,
  creatorLabel = "Created by",
}: SidebarDetailsSectionProps) => {
  const hasUpdatedAt = entity.updatedAt !== undefined;
  return (
    <SidebarSection title="Details">
      <CommonField
        name={creatorLabel}
        value={
          entity.creator ? (
            <Entity entity={{ ...entity.creator, entityType: "user" }} />
          ) : null
        }
        span="full"
      />
      <CommonField
        name="Created"
        value={<RelativeTime date={entity.createdAt} />}
        span={hasUpdatedAt ? "half" : "full"}
      />
      {hasUpdatedAt && (
        <CommonField
          name="Last Updated"
          value={
            entity.updatedAt ? <RelativeTime date={entity.updatedAt} /> : null
          }
          span="half"
        />
      )}
      {entity.revisionNumber !== undefined && (
        <CommonField
          name="Revision"
          value={entity.revisionNumber}
          span="full"
        />
      )}
    </SidebarSection>
  );
};
