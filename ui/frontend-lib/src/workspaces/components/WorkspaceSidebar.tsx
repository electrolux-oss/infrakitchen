import { useCallback } from "react";

import { Grid, TextField } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
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
import {
  GqlWorkspace,
  UPDATE_WORKSPACE_MUTATION,
  WorkspaceUpdateFieldInput,
} from "../graphql";

export interface WorkspaceSidebarProps {
  workspace: GqlWorkspace;
}

/**
 * GitHub-style right sidebar for the workspace detail page: groups the
 * workspace's description, status and history so the main column can focus on
 * its configuration and the entities that use it.
 */
export const WorkspaceSidebar = ({ workspace }: WorkspaceSidebarProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:workspace", "write");

  const saveField = useCallback(
    async (input: WorkspaceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_WORKSPACE_MUTATION, {
          id: workspace.id,
          input,
        });
        notify("Workspace updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, workspace.id, refreshEntity],
  );

  return (
    <EntitySidebar ariaLabel="Workspace details">
      <SidebarSection title="About">
        <CommonEditableField<string>
          name={"Name"}
          canEdit={canEdit}
          value={workspace.name}
          ariaLabel="Edit name"
          display={<span>{workspace.name}</span>}
          onSave={(value) => saveField({ name: value })}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value}
              onChange={(e) => onChange(e.target.value)}
              slotProps={{ input: { "aria-label": "Name" } }}
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          size={12}
        />
        <EditableDescriptionField
          value={workspace.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={workspace.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <StatusChip status={workspace.status} />
        </Grid>
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            workspace.creator ? (
              <Entity entity={{ ...workspace.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={workspace.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={workspace.updatedAt} />}
          size={6}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
