import { useCallback, useEffect, useState } from "react";

import { Box, Grid, TextField } from "@mui/material";

import { Entity } from "../../common";
import { FavoriteButton } from "../../common/components/buttons/FavoriteButton";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { ScheduledApplyValue } from "../../common/components/fields/ScheduledApplyValue";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { usePendingScheduledAction } from "../../common/hooks/usePendingScheduledAction";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import { ProviderIcon } from "../../icons/Icons";
import { ToolSelect, toolLabel } from "../../tools";
import { IkEntity } from "../../types";
import {
  ExecutorUpdateFieldInput,
  EXECUTOR_UPDATE_MUTATION,
  GqlExecutor,
} from "../graphql";

const STORAGE_DANGER_HELPER =
  "Changing storage can cause OpenTofu/Terraform state issues. Only change it when intentionally migrating state.";

const INTEGRATION_STORAGE_WARNING =
  "Changing integrations affects storage: a storage belongs to a single integration, so removing the integration that backs the current storage will require selecting a new storage.";

export interface ExecutorSidebarProps {
  executor: GqlExecutor;
}

/**
 * GitHub-style right sidebar for the executor detail page: groups the
 * executor's description, status, infrastructure bindings and history so the main
 * column can focus on its source configuration and activity.
 */
export const ExecutorSidebar = ({ executor }: ExecutorSidebarProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, userEntityPermissions } = useEntityProvider();
  const { pendingScheduledAction } = usePendingScheduledAction();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = userEntityPermissions.includes("admin");
  const canEditInfra = checkActionPermission("api:executor", "write");
  // Storage edits can corrupt Terraform/OpenTofu state, so they stay behind an
  // admin permission and an explicit unlock.
  const canEditStorage = canEdit;
  const [buffer, setBuffer] = useState<Record<string, IkEntity[]>>({});
  const [isStorageUnlocked, setIsStorageUnlocked] = useState(false);
  const [isStoragePathUnlocked, setIsStoragePathUnlocked] = useState(false);

  // Track the live integration selection so the storage list is filtered by the
  // integrations currently chosen in the editor, not just the saved value. A
  // storage belongs to a single integration, so the selectable storages must
  // follow whatever integrations the user has picked.
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<
    string[] | undefined
  >(() => executor.integrationIds?.map((i) => i.id));

  useEffect(() => {
    setSelectedIntegrationIds(executor.integrationIds?.map((i) => i.id));
  }, [executor.integrationIds]);

  const storageFilter = { integration_id: selectedIntegrationIds };

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
    <EntitySidebar ariaLabel="Executor details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={executor.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={executor.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <StatusChip status={executor.status} state={executor.state} />
            <FavoriteButton
              componentId={String(executor.id)}
              componentType="executor"
              ariaLabel="Add executor to favorites"
              isFavorite={executor.isFavorite}
            />
          </Box>
        </Grid>
        {pendingScheduledAction && (
          <CommonField
            name="Next Scheduled Apply"
            value={
              <ScheduledApplyValue scheduledAction={pendingScheduledAction} />
            }
            size={12}
          />
        )}
      </SidebarSection>

      <SidebarSection title="Infrastructure">
        <CommonEditableField<string[]>
          name={"Integrations"}
          canEdit={canEditInfra}
          value={executor.integrationIds?.map((i) => i.id) ?? []}
          ariaLabel="Edit integrations"
          isEqual={sameStringSet}
          display={
            executor.integrationIds && executor.integrationIds.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {executor.integrationIds.map((parent) => (
                  <Entity
                    key={parent.id}
                    entity={parent}
                    providerIconSize={24}
                  />
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
              ariaLabel="Integrations"
              placeholder="Select credentials…"
              helpertext={INTEGRATION_STORAGE_WARNING}
              multiple
            />
          )}
          size={12}
        />
        <CommonEditableField<string[]>
          name={"Secrets"}
          canEdit={canEditInfra}
          value={executor.secretIds?.map((s) => s.id) ?? []}
          ariaLabel="Edit secrets"
          isEqual={sameStringSet}
          display={
            executor.secretIds && executor.secretIds.length > 0 ? (
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
              ariaLabel="Secrets"
              placeholder="Select secrets…"
              singleLine
              helpertext="Select secrets for the executor"
              multiple
            />
          )}
          size={12}
        />
        <CommonEditableField<string | null>
          name={"Storage"}
          canEdit={canEditStorage && isStorageUnlocked}
          lock={
            canEditStorage
              ? {
                  locked: !isStorageUnlocked,
                  onToggle: () => setIsStorageUnlocked((unlocked) => !unlocked),
                  lockedTitle: "Storage is locked",
                  lockedDescription:
                    "Changing storage can cause OpenTofu/Terraform state issues. Click to unlock and edit.",
                  unlockedTitle: "Storage editing is enabled",
                  unlockedDescription:
                    "Click the lock to lock it again when you are done.",
                }
              : undefined
          }
          disabledTooltip="Only admins can change storage"
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
                fields={["name", "storage_provider", "state"]}
                filter={storageFilter}
                value={value}
                getOptionDisabled={(option: any) =>
                  option.state !== "PROVISIONED"
                }
                onChange={onChange}
                ariaLabel="Storage"
                placeholder="Select storage for TF state…"
                helpertext={STORAGE_DANGER_HELPER}
              />
            </Box>
          )}
          size={12}
        />
        <CommonEditableField<string | null>
          name={"Storage Path"}
          canEdit={canEditStorage && isStoragePathUnlocked}
          lock={
            canEditStorage
              ? {
                  locked: !isStoragePathUnlocked,
                  onToggle: () =>
                    setIsStoragePathUnlocked((unlocked) => !unlocked),
                  lockedTitle: "Storage path is locked",
                  lockedDescription:
                    "Changing the storage path can cause OpenTofu/Terraform state issues. Click to unlock and edit.",
                  unlockedTitle: "Storage path editing is enabled",
                  unlockedDescription:
                    "Click the lock to lock it again when you are done.",
                }
              : undefined
          }
          disabledTooltip="Only admins can change storage path"
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
        <CommonEditableField<string | null>
          name={"IaC Tool"}
          canEdit={canEditInfra}
          value={executor.tool?.id ?? null}
          ariaLabel="Edit IaC tool"
          display={
            executor.tool ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ProviderIcon provider={executor.tool.name} />
                <GetReferenceUrlValue
                  id={executor.tool.id}
                  entityName="tool"
                  display_name={toolLabel(executor.tool)}
                />
              </Box>
            ) : (
              <span>Global default</span>
            )
          }
          onSave={(value) => saveField({ toolId: value })}
          renderEditor={({ value, onChange }) => (
            <ToolSelect value={value} onChange={onChange} />
          )}
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            executor.creator ? (
              <Entity entity={{ ...executor.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={executor.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={executor.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={executor.revisionNumber}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
