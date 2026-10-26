import { EntityRecord } from "../entities/Entity";
import { UserAvatar } from "../entities/UserAvatar";
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
  /** Label for the creation field. */
  createdLabel?: string;
}

/**
 * Sidebar section shared by entity detail pages: when and by whom the entity
 * was created, when it was last updated, and its revision.
 */
export const SidebarDetailsSection = ({
  entity,
  createdLabel = "Created",
}: SidebarDetailsSectionProps) => {
  const hasUpdatedAt = entity.updatedAt !== undefined;
  const hasRevision = entity.revisionNumber !== undefined;
  return (
    <SidebarSection>
      <CommonField
        name={createdLabel}
        value={
          <div className="flex flex-wrap items-center gap-x-1.5">
            <RelativeTime date={entity.createdAt} />
            {entity.creator && (
              <UserAvatar
                id={entity.creator.id}
                identifier={entity.creator.identifier ?? entity.creator.name}
              />
            )}
          </div>
        }
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
      {hasRevision && (
        <CommonField
          name="Revision"
          value={entity.revisionNumber}
          span="full"
        />
      )}
    </SidebarSection>
  );
};
