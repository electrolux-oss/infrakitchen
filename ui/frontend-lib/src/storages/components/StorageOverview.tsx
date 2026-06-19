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
import { GqlStorage } from "../graphql";
import {
  StorageUpdateFieldInput,
  UPDATE_STORAGE_MUTATION,
} from "../graphql/mutations";

export interface StorageAboutProps {
  storage: GqlStorage;
}

export const StorageOverview = ({ storage }: StorageAboutProps) => {
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
    <OverviewCard name={storage.name} description={storage.description}>
      <CommonField
        name={"State"}
        value={<StatusChip status={storage.status} state={storage.state} />}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={storage.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{storage.description || "No description"}</span>}
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
        value={<RelativeTime date={storage.createdAt} user={storage.creator} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={storage.updatedAt} />}
      />
      <CommonEditableField<string[]>
        name={"Storage Tags"}
        canEdit={canEdit}
        value={storage.labels || []}
        ariaLabel="Edit storage tags"
        isEqual={sameStringSet}
        display={<Labels labels={storage.labels || []} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Storage Tags"
            helperText="Press Enter to add a tag"
          />
        )}
        size={12}
      />
    </OverviewCard>
  );
};
