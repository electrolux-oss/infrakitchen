import { useCallback } from "react";

import { TextField } from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
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

export interface WorkspaceAboutProps {
  workspace: GqlWorkspace;
}

export const WorkspaceOverview = ({ workspace }: WorkspaceAboutProps) => {
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
    <OverviewCard name={workspace.name}>
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
        size={6}
      />
      <CommonField
        name={"State"}
        value={<StatusChip status={workspace.status} />}
        size={6}
      />{" "}
      <EditableDescriptionField
        value={workspace.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={workspace.createdAt} user={workspace.creator} />
        }
        size={6}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={workspace.updatedAt} />}
        size={6}
      />{" "}
      <EditableTagsField
        value={workspace.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
      />
    </OverviewCard>
  );
};
