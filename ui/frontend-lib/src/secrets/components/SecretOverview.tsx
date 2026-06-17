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
import {
  SecretUpdateFieldInput,
  UPDATE_SECRET_MUTATION,
} from "../graphql/mutations";
import { SecretResponse } from "../types";

const sameStringSet = (a: string[], b: string[]) =>
  a.length === b.length &&
  [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

export interface SecretAboutProps {
  secret: SecretResponse;
}

export const SecretOverview = ({ secret }: SecretAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:secret", "write");

  const saveField = useCallback(
    async (input: SecretUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_SECRET_MUTATION, {
          id: secret.id,
          input,
        });
        notify("Secret updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, secret.id, refreshEntity],
  );

  return (
    <OverviewCard name={secret.name} description={secret.description}>
      <CommonField
        name={"State"}
        value={<StatusChip status={secret.status} state={secret.state} />}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={secret.created_at} user={secret.creator} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={secret.updated_at} />}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={secret.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{secret.description || "No description"}</span>}
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
      <CommonEditableField<string[]>
        name={"Secret Tags"}
        canEdit={canEdit}
        value={secret.labels}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={secret.labels} />}
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
