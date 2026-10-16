import { Typography } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
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
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {batchOperation.description}
              </Typography>
            ) : (
              <PlaceholderText text="No description provided." />
            )
          }
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Scope">
        <CommonField
          name="Entity Type"
          value={
            batchOperation.entityType === "resource" ? "Resources" : "Executors"
          }
          size={6}
        />
        <CommonField
          name="Total Entities"
          value={batchOperation?.entityIds?.length || 0}
          size={6}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            batchOperation.creator ? (
              <Entity
                entity={{ ...batchOperation.creator, entityType: "user" }}
              />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={batchOperation.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={batchOperation.updatedAt} />}
          size={6}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
