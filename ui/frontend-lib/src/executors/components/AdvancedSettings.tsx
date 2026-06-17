import { useCallback, useEffect, useState } from "react";

import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, IconButton, TextField, Tooltip, Typography } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { OverviewCard } from "../../common/components/OverviewCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { sameStringSet } from "../../common/utils";
import { PermissionWrapper } from "../../common/wrappers";
import { IkEntity } from "../../types";
import { ExecutorUpdateFieldInput, EXECUTOR_UPDATE_MUTATION } from "../graphql";
import { ExecutorResponse } from "../types";

export interface AdvancedSettingsProps {
  executor: ExecutorResponse;
}

const STORAGE_DANGER_HELPER =
  "Changing storage can cause OpenTofu/Terraform state issues. Only change it when intentionally migrating state.";

const INTEGRATION_STORAGE_WARNING =
  "Changing integrations affects storage: a storage belongs to a single integration, so removing the integration that backs the current storage will require selecting a new storage.";

export const AdvancedSettings = ({ executor }: AdvancedSettingsProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:executor", "write");
  const canEditStorage = checkActionPermission("api:storage", "admin");

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

  const [buffer, setBuffer] = useState<Record<string, IkEntity[]>>({});
  const [isStorageUnlocked, setIsStorageUnlocked] = useState(false);

  // Track the live integration selection so the storage list is filtered by the
  // integrations currently chosen in the editor, not just the saved value. A
  // storage belongs to a single integration, so the selectable storages must
  // follow whatever integrations the user has picked.
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<
    string[]
  >(() => executor.integrationIds.map((i) => i.id));

  useEffect(() => {
    setSelectedIntegrationIds(executor.integrationIds.map((i) => i.id));
  }, [executor.integrationIds]);

  const storageFilter = { integration_id: selectedIntegrationIds };

  return (
    <OverviewCard>
      <CommonField name={"Revision"} value={executor.revisionNumber} />
      <PermissionWrapper
        requiredPermission="api:storage"
        permissionAction="admin"
      >
        <CommonField
          name={"Storage editing"}
          value={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip
                title={
                  isStorageUnlocked
                    ? "Lock storage fields"
                    : "Unlock storage fields"
                }
              >
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => setIsStorageUnlocked((unlocked) => !unlocked)}
                  aria-label={
                    isStorageUnlocked
                      ? "Lock storage fields"
                      : "Unlock storage fields"
                  }
                >
                  {isStorageUnlocked ? (
                    <LockOpenOutlinedIcon fontSize="small" />
                  ) : (
                    <LockOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Typography variant="body2" color="warning.main">
                {isStorageUnlocked
                  ? "Storage editing is enabled. Changing storage can cause OpenTofu/Terraform state issues."
                  : "Storage is locked. Click the lock icon to edit. Changing storage can cause OpenTofu/Terraform state issues."}
              </Typography>
            </Box>
          }
        />
      </PermissionWrapper>
      <CommonEditableField<string | null>
        name={"Storage"}
        canEdit={canEditStorage && isStorageUnlocked}
        disabledTooltip={
          canEditStorage
            ? "Unlock storage editing to change this field"
            : "Only admins can change storage"
        }
        value={executor.storage?.id ?? null}
        ariaLabel="Edit storage"
        display={
          executor.storage ? (
            <GetReferenceUrlValue {...executor.storage} />
          ) : null
        }
        onSave={(value) => saveField({ storageId: value })}
        renderEditor={({ value, onChange }) => (
          <Box sx={{ width: "100%" }}>
            <ReferenceInput
              ikApi={ikApi}
              entity_name="storages"
              buffer={buffer}
              setBuffer={setBuffer}
              showFields={["name", "storage_provider"]}
              filter={storageFilter}
              value={value}
              onChange={onChange}
              label="Select Storage for storing TF state"
              helpertext={STORAGE_DANGER_HELPER}
            />
          </Box>
        )}
      />
      <CommonEditableField<string[]>
        name={"Integrations"}
        canEdit={canEdit}
        value={executor.integrationIds.map((i) => i.id)}
        ariaLabel="Edit integrations"
        isEqual={sameStringSet}
        display={
          executor.integrationIds.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {executor.integrationIds.map((parent) => (
                <span key={parent.id}>
                  <GetReferenceUrlValue
                    {...parent}
                    urlProvider={parent.integrationProvider}
                  />
                </span>
              ))}
            </Box>
          ) : null
        }
        onSave={(value) => saveField({ integrationIds: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            entity_name="integrations"
            filter={{ integration_type: "cloud" }}
            showFields={["integrationProvider", "name"]}
            buffer={buffer}
            setBuffer={setBuffer}
            value={value}
            onChange={(selected: string[]) => {
              onChange(selected);
              setSelectedIntegrationIds(selected);
            }}
            label="Credentials"
            helpertext={INTEGRATION_STORAGE_WARNING}
            multiple
          />
        )}
        size={6}
      />
      <CommonEditableField<string[]>
        name={"Secrets"}
        canEdit={canEdit}
        value={executor.secretIds.map((s) => s.id)}
        ariaLabel="Edit secrets"
        isEqual={sameStringSet}
        display={
          executor.secretIds.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {executor.secretIds.map((secret) => (
                <span key={secret.id}>
                  <GetReferenceUrlValue {...secret} />
                </span>
              ))}
            </Box>
          ) : null
        }
        onSave={(value) => saveField({ secretIds: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            entity_name="secrets"
            buffer={buffer}
            setBuffer={setBuffer}
            value={value}
            onChange={onChange}
            label="Secrets"
            helpertext="Select secrets for the executor"
            multiple
          />
        )}
        size={6}
      />

      <CommonEditableField<string | null>
        name={"Storage Path"}
        canEdit={canEditStorage && isStorageUnlocked}
        disabledTooltip={
          canEditStorage
            ? "Unlock storage editing to change this field"
            : "Only admins can change storage path"
        }
        value={executor.storagePath}
        ariaLabel="Edit storage path"
        display={<span>{executor.storagePath}</span>}
        onSave={(value) => saveField({ storagePath: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            label="Storage Path"
            fullWidth
            margin="normal"
            autoFocus
            helperText="Frozen field used as the OpenTofu/Terraform state path. Make sure the path is unique within the selected storage."
          />
        )}
        size={12}
      />
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
    </OverviewCard>
  );
};
