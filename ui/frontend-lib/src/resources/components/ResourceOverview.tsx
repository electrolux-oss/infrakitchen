import { ReactNode, useCallback, useMemo, useState } from "react";

import SyncIcon from "@mui/icons-material/Sync";
import {
  Box,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { PermissionWrapper, UserAvatarList } from "../../common";
import { DownloadSourceCodeButton } from "../../common/components/buttons/DownloadSourceCodeButton";
import {
  CommonField,
  GetReferenceUrlValue,
  getDateValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PendingChangeBadge } from "../../common/components/PendingChangeBadge";
import {
  PlaceholderDescription,
  PlaceholderText,
} from "../../common/components/PlaceholderDescription";
import { RelativeTime } from "../../common/components/RelativeTime";
import { ScheduleEntityActionDialog } from "../../common/components/ScheduleEntityActionDialog";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { usePendingScheduledAction } from "../../common/hooks/usePendingScheduledAction";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import { IkEntity } from "../../types";
import {
  GqlResource,
  ResourceUpdateFieldInput,
  SYNC_WORKSPACE_MUTATION,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql";
import { useResourceNotificationDialog } from "../hooks/useResourceNotificationDialog";

import { SubscribeNotificationButton } from "./notifications/SubscribeNotificationButton";

export interface ResourceAboutProps {
  resource: GqlResource;
  onSubscriptionChange?: () => void;
}

export const ResourceOverview = ({
  resource,
  onSubscriptionChange,
}: ResourceAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, userEntityPermissions, actions, hasPendingChange } =
    useEntityProvider();
  const { permissions } = usePermissionProvider();
  const canEdit =
    userEntityPermissions.includes("write") || actions.includes("edit");
  const { pendingScheduledAction } = usePendingScheduledAction();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useResourceNotificationDialog({
      resourceId: String(resource.id),
      onSubscriptionChange,
    });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const existingIntegrationIds = useMemo(
    () => new Set(resource.integrationIds?.map((i) => String(i.id))),
    [resource.integrationIds],
  );

  const integrationOptionFilter = useMemo(
    () => (option: IkEntity) => {
      if (existingIntegrationIds.has(String(option.id))) return true;
      if (permissions["*"] === "admin") return true;
      const p = permissions[`integration:${option.id}`];
      return p === "write" || p === "admin";
    },
    [existingIntegrationIds, permissions],
  );

  const existingWorkspaceId = resource.workspace?.id
    ? String(resource.workspace.id)
    : null;
  const existingProjectId = resource.project?.id
    ? String(resource.project.id)
    : null;

  const workspaceOptionFilter = useMemo(
    () => (option: IkEntity) => {
      if (existingWorkspaceId && String(option.id) === existingWorkspaceId)
        return true;
      if (permissions["*"] === "admin") return true;
      const p = permissions[`workspace:${option.id}`];
      return p === "write" || p === "admin";
    },
    [existingWorkspaceId, permissions],
  );

  const projectOptionFilter = useMemo(
    () => (option: IkEntity) => {
      if (existingProjectId && String(option.id) === existingProjectId)
        return true;
      if (permissions["*"] === "admin") return true;
      const p = permissions[`project:${option.id}`];
      return p === "write" || p === "admin";
    },
    [existingProjectId, permissions],
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

  const saveField = useCallback(
    async (input: ResourceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_RESOURCE_MUTATION, {
          id: resource.id,
          input,
        });
        notify("Resource updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, resource.id, refreshEntity],
  );

  const withPendingChange = useCallback(
    (display: ReactNode, key: string) => {
      if (!hasPendingChange(key)) {
        return display;
      }

      const isEmptyDisplay =
        display === null || display === undefined || display === "";

      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          {" "}
          {isEmptyDisplay ? <PlaceholderText /> : display}
          <PendingChangeBadge />
        </Box>
      );
    },
    [hasPendingChange],
  );
  const projectOwners = resource.project?.owners
    ? [...resource.project.owners].sort((a, b) =>
        a.identifier.localeCompare(b.identifier),
      )
    : null;

  return (
    <OverviewCard
      name={resource.name}
      actions={
        <>
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
          <DownloadSourceCodeButton entityId={String(resource.id)} />
          <FavoriteButton
            componentId={String(resource.id)}
            componentType="resource"
            ariaLabel="Add resource to favorites"
            isFavorite={resource.isFavorite}
          />
        </>
      }
    >
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
        size={4}
      />{" "}
      <CommonField
        name="State"
        value={<StatusChip status={resource.status} state={resource.state} />}
        size={4}
      />
      <CommonField
        name="Next Scheduled Apply"
        value={
          pendingScheduledAction ? (
            <Typography
              variant="body2"
              sx={{ color: "warning.main", fontWeight: 500 }}
            >
              {getDateValue(pendingScheduledAction.runAt)}
            </Typography>
          ) : null
        }
        size={4}
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
      <CommonField
        name="Created"
        value={
          <RelativeTime date={resource.createdAt} user={resource.creator!} />
        }
        size={4}
      />
      <CommonField
        name="Last Updated"
        value={<RelativeTime date={resource.updatedAt} />}
        size={4}
      />
      <CommonField name="Revision" value={resource.revisionNumber} size={4} />{" "}
      <EditableTagsField
        value={resource.labels ?? []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
        display={withPendingChange(
          <Labels labels={resource.labels || []} />,
          "labels",
        )}
      />
      <Box sx={{ width: "100%", my: 1 }}>
        <Divider />
      </Box>
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
        size={6}
      />
      {resource.abstract === false && (
        <>
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
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  {resource.integrationIds.map((integration) => (
                    <span key={integration.id}>
                      <GetReferenceUrlValue {...integration} />
                    </span>
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
                filter={{ integration_type: "cloud" }}
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
            size={6}
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
                    gap: 1,
                    flexWrap: "wrap",
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
            size={6}
          />

          {resource.project && (
            <CommonField
              name="Owners"
              value={
                !projectOwners || projectOwners.length === 0 ? (
                  <PlaceholderText />
                ) : (
                  <UserAvatarList users={projectOwners} />
                )
              }
              size={6}
            />
          )}

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
            size={6}
          />
        </>
      )}
      <CommonField
        name="Parents"
        size={6}
        value={
          resource.parents && resource.parents.length > 0 ? (
            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                maxHeight: 150,
                overflowY: "auto",
                mt: 1,
                p: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: "var(--template-surface-radius)",
              })}
            >
              {resource.parents.map((parent) => (
                <GetReferenceUrlValue
                  key={parent.id}
                  {...parent}
                  display_name={`${parent.template.name} (${parent.name})`}
                />
              ))}
            </Box>
          ) : null
        }
      />
      <CommonField
        name="Children"
        size={6}
        value={
          resource.children && resource.children.length > 0 ? (
            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                maxHeight: 150,
                overflowY: "auto",
                mt: 1,
                p: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: "var(--template-surface-radius)",
              })}
            >
              {resource.children.map((child) => (
                <GetReferenceUrlValue
                  key={child.id}
                  {...child}
                  display_name={`${child.template.name} (${child.name})`}
                />
              ))}
            </Box>
          ) : null
        }
      />
      <ScheduleEntityActionDialog
        open={isScheduleDialogOpen}
        entityId={String(resource.id)}
        entityType="resource"
        scheduledAction={pendingScheduledAction}
        onClose={() => setIsScheduleDialogOpen(false)}
        onChanged={() => {
          refreshEntity?.();
        }}
      />
    </OverviewCard>
  );
};
