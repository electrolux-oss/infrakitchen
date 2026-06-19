import { useCallback } from "react";

import { TextField } from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
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
    <OverviewCard name={workspace.name} description={workspace.description}>
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
            label="Name"
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
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={workspace.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{workspace.description || "No description"}</span>}
        onSave={(value) => saveField({ description: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Description"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            autoFocus
          />
        )}
        size={12}
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
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={workspace.labels || []}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={workspace.labels || []} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Labels"
            helperText="Press Enter to add a label"
          />
        )}
        size={12}
      />
    </OverviewCard>
  );
};
