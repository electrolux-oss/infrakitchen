import { useCallback } from "react";

import { Grid } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { GqlStorage } from "../graphql";
import {
  StorageUpdateFieldInput,
  UPDATE_STORAGE_MUTATION,
} from "../graphql/mutations";

export interface StorageSidebarProps {
  storage: GqlStorage;
}

/**
 * GitHub-style right sidebar for the storage detail page: groups the
 * storage's description, status and history so the main column can focus on
 * its configuration and the entities that use it.
 */
export const StorageSidebar = ({ storage }: StorageSidebarProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:storage", "write");

  const saveField = useCallback(
    async (input: StorageUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_STORAGE_MUTATION, {
          id: storage.id,
          input,
        });
        notify("Storage updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, storage.id, refreshEntity],
  );

  return (
    <EntitySidebar ariaLabel="Storage details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={storage.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          name="Storage Tags"
          value={storage.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
          helperText="Press Enter to add a tag"
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <StatusChip status={storage.status} state={storage.state} />
        </Grid>
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            storage.creator ? (
              <Entity entity={{ ...storage.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={storage.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={storage.updatedAt} />}
          size={6}
        />
        <CommonField name="Revision" value={storage.revisionNumber} size={12} />
      </SidebarSection>
    </EntitySidebar>
  );
};
