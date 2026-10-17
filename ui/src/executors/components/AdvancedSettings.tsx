import { BaseCard } from "../../common/components/cards/BaseCard";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { TextField } from "../../ui";
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
  const { userEntityPermissions } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:executor", "write");
  const canEditSource = userEntityPermissions.includes("admin");

  const saveField = useEntityFieldSaver<ExecutorUpdateFieldInput>(
    EXECUTOR_UPDATE_MUTATION,
    executor.id,
    "Executor",
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
        span="full"
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
        span="full"
      />
    </BaseCard>
  );
};
