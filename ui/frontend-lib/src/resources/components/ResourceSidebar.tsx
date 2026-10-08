import { ReactNode, useMemo, useState } from "react";

import SyncIcon from "@mui/icons-material/Sync";
import {
  Box,
  Card,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { Entity, PermissionWrapper, UserAvatarList } from "../../common";
import { DownloadSourceCodeButton } from "../../common/components/buttons/DownloadSourceCodeButton";
import { FavoriteButton } from "../../common/components/buttons/FavoriteButton";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { EditAffordance } from "../../common/components/editors/EditAffordance";
import { InlineEditableFieldLock } from "../../common/components/editors/InlineEditableField";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import {
  PlaceholderDescription,
  PlaceholderText,
} from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { ScheduledApplyValue } from "../../common/components/fields/ScheduledApplyValue";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { Labels } from "../../common/components/labels/Labels";
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
import { GqlResource, SYNC_WORKSPACE_MUTATION } from "../graphql";
import { useResourceFieldEditor } from "../hooks/useResourceFieldEditor";
import { useResourceNotificationDialog } from "../hooks/useResourceNotificationDialog";

import { SubscribeNotificationButton } from "./notifications/SubscribeNotificationButton";

export interface ResourceSidebarProps {
  resource: GqlResource;
  /** Opens the variables / template version edit dialog. */
  onEditVariables: () => void;
  onSubscriptionChange?: () => void;
}

interface SidebarSectionProps {
  title: string;
  count?: number;
  /** Optional control rendered flush to the right of the section title. */
  action?: ReactNode;
  children: ReactNode;
}

/** Titled group of sidebar fields, separated from the next by a divider. */
const SidebarSection = ({
  title,
  count,
  action,
  children,
}: SidebarSectionProps) => (
  <Box
    component="section"
    sx={{
      p: 2,
      "&:not(:last-of-type)": {
        borderBottom: 1,
        borderColor: "divider",
      },
    }}
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        // Keep the title baseline steady whether or not an action is present.
        minHeight: 32,
        mb: 1.5,
      }}
    >
      <Typography
        component="h3"
        sx={{
          fontWeight: 600,
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {title}
        {count !== undefined && (
          <Box
            component="span"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "text.secondary",
              bgcolor: "action.hover",
              borderRadius: "999px",
              px: 0.75,
              lineHeight: 1.6,
            }}
          >
            {count}
          </Box>
        )}
      </Typography>
      {action}
    </Box>
    <Grid container spacing={1.5}>
      {children}
    </Grid>
  </Box>
);

type Permissions = ReturnType<typeof usePermissionProvider>["permissions"];

/**
 * Option filter for reference pickers: keeps the entities already attached to
 * the resource and otherwise only offers those the user can write to.
 */
const makeWriteAccessFilter =
  (permissions: Permissions, entityName: string, existingIds: Set<string>) =>
  (option: IkEntity) => {
    if (existingIds.has(String(option.id))) return true;
    if (permissions["*"] === "admin") return true;
    const p = permissions[`${entityName}:${option.id}`];
    return p === "write" || p === "admin";
  };

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

const sortByName = <T extends { name?: string | null }>(items: T[]) =>
  [...items].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

/** Scrollable list of related resources for the Parents/Children sections. */
const RelatedResources = ({
  resources,
}: {
  resources: GqlResource["parents"];
}) =>
  resources && resources.length > 0 ? (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        maxHeight: 180,
        overflowY: "auto",
      }}
    >
      {sortByName(resources).map((related) => (
        <Entity key={related.id} entity={related} showLabel stacked />
      ))}
    </Box>
  ) : null;

/**
 * GitHub-style right sidebar for the resource detail page: groups the context a
 * user scans for first — ownership, template, infrastructure bindings,
 * relations and history — so the main column can focus on the resource itself.
 */
export const ResourceSidebar = ({
  resource,
  onEditVariables,
  onSubscriptionChange,
}: ResourceSidebarProps) => {
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
  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useResourceNotificationDialog({
      resourceId: String(resource.id),
      onSubscriptionChange,
    });
  const { pendingScheduledAction } = usePendingScheduledAction();
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

  const projectId = resource.project?.id;
  const projectOptionFilter = useMemo(
    () =>
      makeWriteAccessFilter(
        permissions,
        "project",
        new Set(projectId ? [String(projectId)] : []),
      ),
    [projectId, permissions],
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

  const projectOwners = resource.project?.owners ?? [];
  const parents = resource.parents ?? [];
  const children = resource.children ?? [];

  return (
    <Card component="aside" aria-label="Resource details" sx={{ p: 0 }}>
      <SidebarSection title="About">
        <CommonEditableField<string>
          name="Name"
          canEdit={canEdit}
          value={resource.name}
          ariaLabel="Edit name"
          display={withPendingChange(<span>{resource.name}</span>, "name")}
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
          size={12}
        />
        <EditableDescriptionField
          value={resource.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
          display={withPendingChange(
            resource.description ? (
              <span>{resource.description}</span>
            ) : (
              <PlaceholderDescription />
            ),
            "description",
          )}
        />
        <EditableTagsField
          value={resource.labels ?? []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
          display={withPendingChange(
            <Labels labels={resource.labels || []} />,
            "labels",
          )}
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
            <StatusChip status={resource.status} state={resource.state} />
            <FavoriteButton
              componentId={String(resource.id)}
              componentType="resource"
              ariaLabel="Add resource to favorites"
              isFavorite={resource.isFavorite}
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

      <SidebarSection title="Project">
        <CommonEditableField<string | null>
          name="Project"
          canEdit={canEdit}
          value={resource.project?.id ?? null}
          ariaLabel="Edit project"
          display={withPendingChange(
            resource.project ? (
              <GetReferenceUrlValue {...resource.project} />
            ) : null,
            "project_id",
          )}
          onSave={(value) => saveField({ projectId: value })}
          renderEditor={({ value, onChange }) => (
            <ReferenceInput
              ikApi={ikApi}
              buffer={buffer}
              setBuffer={setBuffer}
              entity_name="projects"
              showFields={["name"]}
              optionFilter={projectOptionFilter}
              value={value}
              onChange={onChange}
              ariaLabel="Project"
              placeholder="Select project…"
              helpertext="Only projects you have write access to are shown"
            />
          )}
          size={12}
        />
        {resource.project && (
          <CommonField
            name="Owners"
            value={
              projectOwners.length ? (
                <UserAvatarList users={projectOwners} max={8} />
              ) : (
                <PlaceholderText />
              )
            }
            size={12}
          />
        )}
      </SidebarSection>

      <SidebarSection
        title="Template"
        // Abstract resources have no source code to download.
        action={
          resource.abstract === false && (
            <DownloadSourceCodeButton entityId={String(resource.id)} />
          )
        }
      >
        <CommonField
          name="Template"
          value={
            resource.template ? (
              <GetReferenceUrlValue {...resource.template} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <span>Template Version</span>
              {/* Changing the version goes through the variables dialog, as
                  the new version can add or drop input variables. */}
              {canEdit && (
                <Box
                  component="span"
                  sx={{ display: "inline-flex", my: -0.75 }}
                >
                  <EditAffordance
                    onClick={onEditVariables}
                    ariaLabel="Change template version"
                    title="Change template version"
                  />
                </Box>
              )}
            </Box>
          }
          value={withPendingChange(
            resource.sourceCodeVersion ? (
              <Entity entity={resource.sourceCodeVersion} />
            ) : null,
            "source_code_version_id",
          )}
          size={12}
        />
        {/* The IaC tool only applies to resources that keep TF state. */}
        {resource.storage && (
          <CommonEditableField<string | null>
            name="IaC Tool"
            canEdit={canEdit}
            value={resource.tool?.id ?? null}
            ariaLabel="Edit IaC tool"
            display={withPendingChange(
              resource.tool ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ProviderIcon provider={resource.tool.name} />
                  <GetReferenceUrlValue
                    id={resource.tool.id}
                    entityName="tool"
                    display_name={toolLabel(resource.tool)}
                  />
                </Box>
              ) : (
                <span>Global default</span>
              ),
              "tool_id",
            )}
            onSave={(value) => saveField({ toolId: value })}
            renderEditor={({ value, onChange }) => (
              <ToolSelect value={value} onChange={onChange} />
            )}
            size={12}
          />
        )}
      </SidebarSection>

      {resource.abstract === false && (
        <SidebarSection title="Infrastructure">
          <CommonEditableField<string | null>
            name="Workspace"
            canEdit={canEdit}
            value={resource.workspace?.id ?? null}
            ariaLabel="Edit workspace"
            display={withPendingChange(
              resource.workspace ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <GetReferenceUrlValue {...resource.workspace} />
                  <PermissionWrapper
                    requiredPermission="api:resource"
                    permissionAction="admin"
                  >
                    <Tooltip title="Sync workspace">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleSync}
                          disabled={isSyncing}
                          sx={{ "& .MuiSvgIcon-root": { fontSize: "1.2rem" } }}
                        >
                          <SyncIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </PermissionWrapper>
                </Box>
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
            size={12}
          />
          <CommonEditableField<string[]>
            name="Cloud Integrations"
            canEdit={canEdit}
            value={resource.integrationIds?.map((i) => i.id) || []}
            ariaLabel="Edit cloud integrations"
            isEqual={sameStringSet}
            display={withPendingChange(
              resource.integrationIds && resource.integrationIds.length > 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {resource.integrationIds.map((integration) => (
                    <Entity
                      key={integration.id}
                      entity={integration}
                      providerIconSize={20}
                    />
                  ))}
                </Box>
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
            size={12}
          />
          <CommonEditableField<string[]>
            name="Secrets"
            canEdit={canEdit}
            value={resource.secretIds?.map((s) => s.id) || []}
            ariaLabel="Edit secrets"
            isEqual={sameStringSet}
            display={withPendingChange(
              resource.secretIds && resource.secretIds.length > 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {resource.secretIds.map((secret) => (
                    <span key={secret.id}>
                      <GetReferenceUrlValue {...secret} />
                    </span>
                  ))}
                </Box>
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
            size={12}
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
                    <GetReferenceUrlValue {...resource.storage} />
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
                size={12}
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
                      <span>{resource.storagePath}</span>
                    ) : null,
                    "storage_path",
                  )}
                  onSave={(value) => saveField({ storagePath: value })}
                  renderEditor={({ value, onChange }) => (
                    <TextField
                      value={value ?? ""}
                      onChange={(e) => onChange(e.target.value || null)}
                      slotProps={{
                        input: { "aria-label": "Storage Path" },
                      }}
                      fullWidth
                      margin="normal"
                      autoFocus
                      helperText="By default InfraKitchen uses `service-catalog/{template}/{resource_name}/terraform.tfstate` as the path."
                    />
                  )}
                  size={12}
                />
              )}
            </>
          ) : (
            <>
              <CommonField
                name="Storage"
                value={withPendingChange(
                  resource.storage ? (
                    <GetReferenceUrlValue {...resource.storage} />
                  ) : null,
                  "storage_id",
                )}
                size={12}
              />
              <CommonField
                name="Storage Path"
                value={withPendingChange(resource.storagePath, "storage_path")}
                size={12}
              />
            </>
          )}
        </SidebarSection>
      )}

      <SidebarSection title="Parents" count={parents.length}>
        <Grid size={12}>
          {parents.length ? (
            <RelatedResources resources={parents} />
          ) : (
            <PlaceholderText text="No parent resources" />
          )}
        </Grid>
      </SidebarSection>

      <SidebarSection title="Children" count={children.length}>
        <Grid size={12}>
          {children.length ? (
            <RelatedResources resources={children} />
          ) : (
            <PlaceholderText text="No child resources" />
          )}
        </Grid>
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            resource.creator ? (
              <Entity entity={{ ...resource.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={resource.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={resource.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={resource.revisionNumber}
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Notifications">
        <Grid size={12}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {isSubscribed ? "Subscribed" : "Not subscribed"}
            </Typography>
            <SubscribeNotificationButton
              isSubscribed={isSubscribed}
              isLoading={loading}
              onSubscribeClick={(inheritChildren) =>
                void handleSubscribe(inheritChildren)
              }
              onUnsubscribeClick={(inheritChildren) =>
                void handleUnsubscribe(inheritChildren)
              }
            />
          </Box>
        </Grid>
      </SidebarSection>
    </Card>
  );
};
