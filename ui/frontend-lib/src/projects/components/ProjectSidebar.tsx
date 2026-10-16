import { useCallback, useMemo, useRef, useState } from "react";

import { Box, Grid, TextField } from "@mui/material";

import { UserAvatarList } from "../../common";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { SubscribeNotificationButton } from "../../resources/components/notifications/SubscribeNotificationButton";
import { IkEntity } from "../../types";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import { GqlProject } from "../graphql";
import {
  ProjectUpdateFieldInput,
  UPDATE_PROJECT_MUTATION,
} from "../graphql/mutations";
import { useProjectNotificationDialog } from "../hooks";

type UserOption = GqlUserShort & { displayName?: string | null };

const getUserLabel = (user: UserOption) => user.displayName || user.identifier;

const sameUserSet = (a: UserOption[] | null, b: UserOption[] | null) => {
  const x = (a || []).map((user) => user.id).sort();
  const y = (b || []).map((user) => user.id).sort();

  return x.length === y.length && x.join("\u0000") === y.join("\u0000");
};

const ownersDisplay = (owners: UserOption[] | null) =>
  owners?.length ? <UserAvatarList users={owners} /> : <PlaceholderText />;

export interface ProjectSidebarProps {
  project: GqlProject;
  onSubscriptionChange?: () => void;
}

/**
 * GitHub-style right sidebar for the project detail page: groups the
 * project's description, status, relations and history so the main column can
 * focus on its golden state, resources and settings.
 */
export const ProjectSidebar = ({
  project,
  onSubscriptionChange,
}: ProjectSidebarProps) => {
  const { ikApi } = useConfig();
  const { actions, refreshEntity } = useEntityProvider();
  const canEdit = actions.includes("edit");

  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useProjectNotificationDialog({
      projectId: String(project.id),
      onSubscriptionChange,
    });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [users, setUsers] = useState<UserOption[]>([]);
  const ownersLoadedRef = useRef(false);

  const loadUsers = useCallback(async () => {
    if (ownersLoadedRef.current) {
      return;
    }

    ownersLoadedRef.current = true;

    try {
      const response = await ikApi.graphqlRequest<{ users: UserOption[] }>(
        USERS_SHORT_QUERY,
        {
          sort: ["identifier", "ASC"],
          range: [0, 999],
        },
      );
      setUsers(response.users || []);
    } catch (error) {
      ownersLoadedRef.current = false;
      notifyError(error);
    }
  }, [ikApi]);

  const saveField = useCallback(
    async (input: ProjectUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_PROJECT_MUTATION, {
          id: project.id,
          input,
        });
        notify("Project updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, project.id, refreshEntity],
  );

  const ownerValues = useMemo<UserOption[]>(
    () =>
      (project.owners || [])
        .map((owner) => {
          const loadedUser = users.find((user) => user.id === owner.id);
          return loadedUser || owner;
        })
        .sort((a, b) => a.identifier.localeCompare(b.identifier)),
    [project.owners, users],
  );

  return (
    <EntitySidebar ariaLabel="Project details">
      <SidebarSection title="About">
        <CommonEditableField<string>
          name={"Name"}
          canEdit={canEdit}
          value={project.name}
          ariaLabel="Edit name"
          display={<span>{project.name}</span>}
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
          value={project.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={project.labels || []}
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
            <StatusChip status={project.status} />
            <SubscribeNotificationButton
              isSubscribed={isSubscribed}
              isLoading={loading}
              onSubscribeClick={() => {
                void handleSubscribe();
              }}
              onUnsubscribeClick={() => {
                void handleUnsubscribe();
              }}
              entityName="project"
              showIncludeChildren={false}
            />
          </Box>
        </Grid>
      </SidebarSection>

      <SidebarSection title="Relations">
        <CommonEditableField<string | null>
          name={"Workspace"}
          canEdit={canEdit}
          value={project.workspace?.id ?? null}
          ariaLabel="Edit workspace"
          display={
            project.workspace ? (
              <Entity
                entity={{ ...project.workspace, entityType: "workspace" }}
              />
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
              value={value}
              onChange={onChange}
              ariaLabel="Workspace"
              placeholder="Select workspace…"
            />
          )}
          size={12}
        />
        <CommonEditableField<UserOption[]>
          name={"Owners"}
          canEdit={canEdit}
          value={ownerValues}
          ariaLabel="Edit owners"
          isEqual={sameUserSet}
          display={ownersDisplay(ownerValues)}
          onSave={(value) =>
            saveField({ owners: value.map((owner) => owner.id) })
          }
          onEditStart={loadUsers}
          renderEditor={({ value, onChange }) => (
            <MultiSelectEditor<UserOption>
              value={value}
              onChange={onChange}
              ariaLabel="Owners"
              placeholder="Select users…"
              helperText="Optional users allowed to edit this project"
              options={users}
              getOptionLabel={getUserLabel}
            />
          )}
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            project.creator ? (
              <Entity entity={{ ...project.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={project.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={project.updatedAt} />}
          size={6}
        />
        <CommonField name="Revision" value={project.revisionNumber} size={12} />
      </SidebarSection>
    </EntitySidebar>
  );
};
