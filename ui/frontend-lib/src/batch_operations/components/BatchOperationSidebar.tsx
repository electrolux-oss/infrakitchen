import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { CommonField } from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { GqlBatchOperation } from "../graphql";

export interface BatchOperationSidebarProps {
  batchOperation: GqlBatchOperation;
}

/**
 * GitHub-style right sidebar for the batch operation detail page: groups the
 * operation's description, scope and history so the main column can focus on
 * the entities it runs against.
 */
export const BatchOperationSidebar = ({
  batchOperation,
}: BatchOperationSidebarProps) => {
  return (
    <EntitySidebar ariaLabel="Batch operation details">
      <SidebarSection title="About">
        <CommonField
          name="Description"
          value={
            batchOperation.description ? (
              <p className="m-0 text-body2 wrap-anywhere">
                {batchOperation.description}
              </p>
            ) : (
              <PlaceholderText text="No description provided." />
            )
          }
          span="full"
        />
      </SidebarSection>

      <SidebarSection title="Scope">
        <CommonField
          name="Entity Type"
          value={
            batchOperation.entityType === "resource" ? "Resources" : "Executors"
          }
          span="half"
        />
        <CommonField
          name="Total Entities"
          value={batchOperation?.entityIds?.length || 0}
          span="half"
        />
      </SidebarSection>

      <SidebarDetailsSection
        entity={{
          creator: batchOperation.creator,
          createdAt: batchOperation.createdAt,
          updatedAt: batchOperation.updatedAt,
        }}
      />
    </EntitySidebar>
  );
};
