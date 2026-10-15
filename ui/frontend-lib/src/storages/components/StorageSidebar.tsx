import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
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
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:storage", "write");

  const saveField = useEntityFieldSaver<StorageUpdateFieldInput>(
    UPDATE_STORAGE_MUTATION,
    storage.id,
    "Storage",
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
        <div className="col-span-full">
          <StatusChip status={storage.status} state={storage.state} />
        </div>
      </SidebarSection>

      <SidebarDetailsSection entity={storage} />
    </EntitySidebar>
  );
};
