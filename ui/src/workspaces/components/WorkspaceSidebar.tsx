import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { CommonField } from "../../common/components/fields/CommonField";
import { StatusLabel } from "../../common/components/labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import {
  GqlWorkspace,
  UPDATE_WORKSPACE_MUTATION,
  WorkspaceUpdateFieldInput,
} from "../graphql";

export interface WorkspaceSidebarProps {
  workspace: GqlWorkspace;
}

/**
 * Right context sidebar for the workspace detail page: groups the
 * workspace's description, status and history so the main column can focus on
 * its configuration and the entities that use it.
 */
export const WorkspaceSidebar = ({ workspace }: WorkspaceSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:workspace", "write");

  const saveField = useEntityFieldSaver<WorkspaceUpdateFieldInput>(
    UPDATE_WORKSPACE_MUTATION,
    workspace.id,
    "Workspace",
  );

  return (
    <EntitySidebar ariaLabel="Workspace details">
      <SidebarSection title="About">
        <EditableNameField
          value={workspace.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={workspace.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={<StatusLabel status={workspace.status} />}
          span="full"
        />
        <EditableTagsField
          value={workspace.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarDetailsSection
        entity={{
          creator: workspace.creator,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        }}
      />
    </EntitySidebar>
  );
};
