import { useEffect, useState } from "react";

import { FavoriteButton } from "../../common/components/buttons/FavoriteButton";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import { ScheduledApplyValue } from "../../common/components/fields/ScheduledApplyValue";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { usePendingScheduledAction } from "../../common/hooks/usePendingScheduledAction";
import { sameStringSet } from "../../common/utils";
import { ToolSelect, toolLabel } from "../../tools";
import { IkEntity } from "../../types";
import { TextField } from "../../ui";
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
 * Right context sidebar for the executor detail page: groups the
 * executor's description, status, infrastructure bindings and history so the main
 * column can focus on its source configuration and activity.
 */
export const ExecutorSidebar = ({ executor }: ExecutorSidebarProps) => {
  const { ikApi } = useConfig();
  const { userEntityPermissions } = useEntityProvider();
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

  const saveField = useEntityFieldSaver<ExecutorUpdateFieldInput>(
    EXECUTOR_UPDATE_MUTATION,
    executor.id,
    "Executor",
  );

  return (
    <EntitySidebar ariaLabel="Executor details">
      <SidebarSection
        title="About"
        action={
          <FavoriteButton
            componentId={String(executor.id)}
            componentType="executor"
            ariaLabel="Add executor to favorites"
            isFavorite={executor.isFavorite}
          />
        }
      >
        <EditableDescriptionField
          value={executor.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={
            <StatusLabel status={executor.status} state={executor.state} />
          }
          span="full"
        />
        <EditableTagsField
          value={executor.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
        {pendingScheduledAction && (
          <CommonField
            name="Next Scheduled Apply"
            value={
              <ScheduledApplyValue scheduledAction={pendingScheduledAction} />
            }
            span="full"
          />
        )}
      </SidebarSection>

      <SidebarSection title="Configuration">
        <CommonEditableField<string[]>
          name={"Integrations"}
          canEdit={canEditInfra}
          value={executor.integrationIds?.map((i) => i.id) ?? []}
          ariaLabel="Edit integrations"
          isEqual={sameStringSet}
          display={
            executor.integrationIds && executor.integrationIds.length > 0 ? (
              <div className="flex flex-col gap-2">
                {executor.integrationIds.map((parent) => (
                  <EntityReference
                    key={parent.id}
                    id={parent.id}
                    entityName="integration"
                    name={parent.name}
                    provider={parent.integrationProvider}
                  />
                ))}
              </div>
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
          span="full"
        />
        <CommonEditableField<string[]>
          name={"Secrets"}
          canEdit={canEditInfra}
          value={executor.secretIds?.map((s) => s.id) ?? []}
          ariaLabel="Edit secrets"
          isEqual={sameStringSet}
          display={
            executor.secretIds && executor.secretIds.length > 0 ? (
              <div className="flex flex-col gap-2">
                {executor.secretIds.map((secret) => (
                  <div key={secret.id} className="flex items-center gap-2">
                    <EntityReference
                      {...secret}
                      provider={secret.secretProvider}
                    />
                  </div>
                ))}
              </div>
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
          span="full"
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
            executor.storage ? <EntityReference {...executor.storage} /> : null
          }
          onSave={(value) => saveField({ storageId: value })}
          renderEditor={({ value, onChange }) => (
            <div className="w-full">
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
            </div>
          )}
          span="full"
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
          display={
            executor.storagePath ? (
              <InlineCode>{executor.storagePath}</InlineCode>
            ) : null
          }
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
          span="full"
        />
        <CommonEditableField<string | null>
          name={"IaC Tool"}
          canEdit={canEditInfra}
          value={executor.tool?.id ?? null}
          ariaLabel="Edit IaC tool"
          display={
            executor.tool ? (
              <EntityReference
                id={executor.tool.id}
                entityName="tool"
                provider={executor.tool.name}
                display_name={toolLabel(executor.tool)}
              />
            ) : (
              <span>Global default</span>
            )
          }
          onSave={(value) => saveField({ toolId: value })}
          renderEditor={({ value, onChange }) => (
            <ToolSelect value={value} onChange={onChange} />
          )}
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={executor} />
    </EntitySidebar>
  );
};
