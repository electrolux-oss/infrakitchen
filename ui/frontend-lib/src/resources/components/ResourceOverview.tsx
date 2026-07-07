import { useCallback, useMemo, useState } from "react";

import SyncIcon from "@mui/icons-material/Sync";
import { Box, Divider, IconButton, TextField, Tooltip } from "@mui/material";

import { PermissionWrapper } from "../../common";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import { IkEntity } from "../../types";
import { GqlResource } from "../graphql";
import {
  ResourceUpdateFieldInput,
  UPDATE_RESOURCE_MUTATION,
  SYNC_WORKSPACE_MUTATION,
} from "../graphql/mutations";

export interface ResourceAboutProps {
  resource: GqlResource;
}

export const ResourceOverview = ({ resource }: ResourceAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, userEntityPermissions } = useEntityProvider();
  const { permissions } = usePermissionProvider();
  const canEdit = userEntityPermissions.includes("write");
  const [isSyncing, setIsSyncing] = useState(false);

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

  return (
    <OverviewCard
      name={resource.name}
      description={resource.description || "No description"}
      actions={
        <FavoriteButton
          componentId={String(resource.id)}
          componentType="resource"
          ariaLabel="Add resource to favorites"
          isFavorite={resource.isFavorite}
        />
      }
    >
      <CommonEditableField<string>
        name="Name"
        canEdit={canEdit}
        value={resource.name}
        ariaLabel="Edit name"
        display={<span>{resource.name}</span>}
        onSave={(value) => saveField({ name: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Name"
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={4}
      />

      <CommonField
        name="State"
        value={<StatusChip status={resource.status} state={resource.state} />}
        size={4}
      />

      <CommonEditableField<string>
        name="Description"
        canEdit={canEdit}
        value={resource.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{resource.description || "No description"}</span>}
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
      <CommonField name="Revision" value={resource.revisionNumber} size={4} />

      <CommonEditableField<string[]>
        name="Labels"
        canEdit={canEdit}
        value={resource.labels ?? []}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={resource.labels || []} />}
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

      <Box sx={{ width: "100%", my: 1 }}>
        <Divider />
      </Box>

      {resource.abstract === false && (
        <>
          <CommonEditableField<string[]>
            name="Cloud Integrations"
            canEdit={canEdit}
            value={resource.integrationIds?.map((i) => i.id) || []}
            ariaLabel="Edit cloud integrations"
            isEqual={sameStringSet}
            display={
              resource.integrationIds && resource.integrationIds.length > 0 ? (
                <Box display="flex" gap={1} flexWrap="wrap">
                  {resource.integrationIds.map((integration) => (
                    <span key={integration.id}>
                      <GetReferenceUrlValue {...integration} />
                    </span>
                  ))}
                </Box>
              ) : null
            }
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
                label="Cloud Integrations"
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
            display={
              resource.secretIds && resource.secretIds.length > 0 ? (
                <Box display="flex" gap={1} flexWrap="wrap">
                  {resource.secretIds.map((secret) => (
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
                buffer={buffer}
                setBuffer={setBuffer}
                entity_name="secrets"
                value={value}
                onChange={onChange}
                label="Secrets"
                multiple
              />
            )}
            size={6}
          />

          <CommonEditableField<string | null>
            name="Workspace"
            canEdit={canEdit}
            value={resource.workspace?.id ?? null}
            ariaLabel="Edit workspace"
            display={
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
              ) : null
            }
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
                label="Workspace"
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
                borderRadius: 1,
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
                borderRadius: 1,
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
    </OverviewCard>
  );
};
