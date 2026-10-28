import { useMemo, useState } from "react";

import { PermissionWrapper } from "../../common";
import { SidebarSection } from "../../common/components/cards/EntitySidebar";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { InlineEditableFieldLock } from "../../common/components/editors/InlineEditableField";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { makeWriteAccessFilter, sameStringSet } from "../../common/utils";
import { HeroArrowPathRoundedSquareIcon } from "../../icons";
import { IkEntity } from "../../types";
import { IconButton, Tooltip, TextField } from "../../ui";
import { GqlResource, SYNC_WORKSPACE_MUTATION } from "../graphql";
import { useResourceFieldEditor } from "../hooks/useResourceFieldEditor";

/** Lock config for the state-sensitive storage fields. */
const storageLock = (
  label: string,
  unlocked: boolean,
  onToggle: () => void,
): InlineEditableFieldLock => ({
  locked: !unlocked,
  onToggle,
  lockedTitle: `${label} is locked`,
  lockedDescription:
    "Changing this can cause OpenTofu/Terraform state issues. Click to unlock and edit.",
  unlockedTitle: `${label} editing is enabled`,
  unlockedDescription: "Click the lock to lock it again when you are done.",
});

/**
 * Resource sidebar section for the infrastructure bindings of a concrete
 * resource: workspace (with sync), cloud integrations, secrets and the
 * OpenTofu/Terraform state storage.
 */
export const ResourceInfrastructureSection = ({
  resource,
}: {
  resource: GqlResource;
}) => {
  const { ikApi } = useConfig();
  const { permissions } = usePermissionProvider();
  const { userEntityPermissions } = useEntityProvider();
  const { canEdit, saveField, withPendingChange } =
    useResourceFieldEditor(resource);
  // Storage edits can corrupt Terraform/OpenTofu state, so they stay behind an
  // admin permission and an explicit unlock.
  const canEditStorage = userEntityPermissions.includes("admin");
  const [isStorageUnlocked, setIsStorageUnlocked] = useState(false);
  const [isStoragePathUnlocked, setIsStoragePathUnlocked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const integrationOptionFilter = useMemo(
    () =>
      makeWriteAccessFilter(
        permissions,
        "integration",
        new Set(resource.integrationIds?.map((i) => String(i.id))),
      ),
    [resource.integrationIds, permissions],
  );

  const workspaceId = resource.workspace?.id;
  const workspaceOptionFilter = useMemo(
    () =>
      makeWriteAccessFilter(
        permissions,
        "workspace",
        new Set(workspaceId ? [String(workspaceId)] : []),
      ),
    [workspaceId, permissions],
  );

  // postgresql storages can always be used, cloud storages only with the
  // resource's integrations; the backend is accessed with the storage integration.
  const storageFilter = useMemo(
    () =>
      resource.integrationIds && resource.integrationIds.length > 0
        ? {
            or: [
              { integration_id: resource.integrationIds.map((i) => i.id) },
              { storage_provider: "postgresql" },
            ],
          }
        : { storage_provider: "postgresql" },
    [resource.integrationIds],
  );

  const handleSync = () => {
    setIsSyncing(true);
    ikApi
      .graphqlRequest(SYNC_WORKSPACE_MUTATION, { id: resource.id })
      .then(() => {
        notify("Sent sync workspace request", "success");
      })
      .catch((error) => {
        notifyError(error);
      })
      .finally(() => {
        setIsSyncing(false);
      });
  };

  return (
    <SidebarSection title="Configuration">
      <CommonEditableField<string | null>
        name="Workspace"
        canEdit={canEdit}
        value={resource.workspace?.id ?? null}
        ariaLabel="Edit workspace"
        display={withPendingChange(
          resource.workspace ? (
            <div className="flex items-center gap-2">
              <EntityReference {...resource.workspace} />
              <PermissionWrapper
                requiredPermission="api:resource"
                permissionAction="admin"
              >
                <Tooltip title="Sync workspace">
                  <span>
                    <IconButton
                      className="size-7 opacity-40 hover:opacity-100 focus-visible:opacity-100"
                      size="small"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      <HeroArrowPathRoundedSquareIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </PermissionWrapper>
            </div>
          ) : null,
          "workspace_id",
        )}
        onSave={(value) => saveField({ workspaceId: value })}
        renderEditor={({ value, onChange }) => (
          <ReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="workspaces"
            showFields={["name", "workspace_provider"]}
            optionFilter={workspaceOptionFilter}
            value={value}
            onChange={onChange}
            ariaLabel="Workspace"
            placeholder="Select workspace…"
            helpertext="Only workspaces you have write access to are shown"
          />
        )}
        span="full"
      />
      <CommonEditableField<string[]>
        name="Cloud Integrations"
        canEdit={canEdit}
        value={resource.integrationIds?.map((i) => i.id) || []}
        ariaLabel="Edit cloud integrations"
        isEqual={sameStringSet}
        display={withPendingChange(
          resource.integrationIds && resource.integrationIds.length > 0 ? (
            <div className="flex flex-col gap-1">
              {resource.integrationIds.map((integration) => (
                <EntityReference
                  key={integration.id}
                  id={integration.id}
                  entityName="integration"
                  name={integration.name}
                  provider={integration.integrationProvider}
                />
              ))}
            </div>
          ) : null,
          "integration_ids",
        )}
        onSave={(value) => saveField({ integrationIds: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="integrations"
            filter={{
              integration_type: "cloud",
              integration_provider__not_eq: "postgresql",
            }}
            showFields={["integrationProvider", "name"]}
            optionFilter={integrationOptionFilter}
            value={value}
            onChange={onChange}
            ariaLabel="Cloud Integrations"
            placeholder="Select cloud integrations…"
            helpertext="Existing integrations are kept; new options are limited to those you have write access to."
            multiple
          />
        )}
        span="full"
      />
      <CommonEditableField<string[]>
        name="Secrets"
        canEdit={canEdit}
        value={resource.secretIds?.map((s) => s.id) || []}
        ariaLabel="Edit secrets"
        isEqual={sameStringSet}
        display={withPendingChange(
          resource.secretIds && resource.secretIds.length > 0 ? (
            <div className="flex flex-col gap-1">
              {resource.secretIds.map((secret) => (
                <div key={secret.id} className="flex items-center gap-2">
                  <EntityReference
                    {...secret}
                    provider={secret.secretProvider}
                  />
                </div>
              ))}
            </div>
          ) : null,
          "secret_ids",
        )}
        onSave={(value) => saveField({ secretIds: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="secrets"
            value={value}
            onChange={onChange}
            ariaLabel="Secrets"
            placeholder="Select secrets…"
            singleLine
            multiple
          />
        )}
        span="full"
      />
      {canEditStorage ? (
        <>
          <CommonEditableField<string | null>
            name="Storage"
            canEdit={canEditStorage}
            value={resource.storage?.id ?? null}
            ariaLabel="Edit storage"
            lock={storageLock("Storage", isStorageUnlocked, () =>
              setIsStorageUnlocked((unlocked) => !unlocked),
            )}
            display={withPendingChange(
              resource.storage ? (
                <EntityReference {...resource.storage} />
              ) : null,
              "storage_id",
            )}
            onSave={(value) => saveField({ storageId: value })}
            renderEditor={({ value, onChange }) => (
              <ReferenceInput
                ikApi={ikApi}
                entity_name="storages"
                buffer={buffer}
                bufferKey="storages"
                showFields={["name", "storage_provider"]}
                fields={["name", "storage_provider", "state"]}
                setBuffer={setBuffer}
                filter={storageFilter}
                value={value}
                onChange={onChange}
                getOptionDisabled={(option: IkEntity) =>
                  option.state !== "PROVISIONED"
                }
                ariaLabel="Storage"
                placeholder="Select storage for TF state…"
                required
                helpertext="Keep this value unchanged unless you are intentionally migrating OpenTofu/Terraform state."
              />
            )}
            span="full"
          />
          {resource.storage && (
            <CommonEditableField<string | null>
              name="Storage Path"
              canEdit={canEditStorage}
              value={resource.storagePath ?? null}
              ariaLabel="Edit storage path"
              lock={storageLock("Storage Path", isStoragePathUnlocked, () =>
                setIsStoragePathUnlocked((unlocked) => !unlocked),
              )}
              display={withPendingChange(
                resource.storagePath ? (
                  <InlineCode>{resource.storagePath}</InlineCode>
                ) : null,
                "storage_path",
              )}
              onSave={(value) => saveField({ storagePath: value })}
              renderEditor={({ value, onChange }) => (
                <TextField
                  value={value ?? ""}
                  onChange={(e) => onChange(e.target.value || null)}
                  aria-label="Storage Path"
                  fullWidth
                  margin="normal"
                  autoFocus
                  helperText="By default InfraKitchen uses `service-catalog/{template}/{resource_name}/terraform.tfstate` as the path."
                />
              )}
              span="full"
            />
          )}
        </>
      ) : (
        <>
          <CommonField
            name="Storage"
            value={withPendingChange(
              resource.storage ? (
                <EntityReference {...resource.storage} />
              ) : null,
              "storage_id",
            )}
            span="full"
          />
          <CommonField
            name="Storage Path"
            value={withPendingChange(
              resource.storagePath ? (
                <InlineCode>{resource.storagePath}</InlineCode>
              ) : null,
              "storage_path",
            )}
            span="full"
          />
        </>
      )}
    </SidebarSection>
  );
};
