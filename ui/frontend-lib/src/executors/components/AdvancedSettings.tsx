import { useCallback } from "react";

import { TextField } from "@mui/material";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  ExecutorUpdateFieldInput,
  EXECUTOR_UPDATE_MUTATION,
  GqlExecutor,
} from "../graphql";

import { SourceCodeConfigEditor } from "./SourceCodeConfigEditor";

export interface AdvancedSettingsProps {
  executor: GqlExecutor;
}

export const AdvancedSettings = ({ executor }: AdvancedSettingsProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, userEntityPermissions } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:executor", "write");
  const canEditSource = userEntityPermissions.includes("admin");

  const saveField = useCallback(
    async (input: ExecutorUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(EXECUTOR_UPDATE_MUTATION, {
          id: executor.id,
          input,
        });
        notify("Executor updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, executor.id, refreshEntity],
  );
  return (
    <BaseCard>
      <CommonField
        name={"Code Repository"}
        value={
          executor.sourceCode ? (
            <GetReferenceUrlValue {...executor.sourceCode} />
          ) : null
        }
        size={12}
      />
      <SourceCodeConfigEditor executor={executor} canEdit={canEditSource} />
      <CommonEditableField<string>
        name={"Command arguments"}
        canEdit={canEdit}
        value={executor.commandArgs ?? ""}
        ariaLabel="Edit command arguments"
        display={<span>{executor.commandArgs}</span>}
        onSave={(value) => saveField({ commandArgs: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Command arguments"
            fullWidth
            margin="normal"
            autoFocus
            helperText="Enter command arguments (e.g., -var-file=prod.tfvars)"
          />
        )}
        size={12}
      />
    </BaseCard>
  );
};
