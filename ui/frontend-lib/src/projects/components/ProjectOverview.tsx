import { useCallback, useMemo, useRef, useState } from "react";

import { Box, TextField, Typography } from "@mui/material";

import { UserAvatar } from "../../common";
import { GetReferenceUrlValue } from "../../common/components/CommonField";
import { CommonField } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import { IkEntity } from "../../types";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import { GqlProject } from "../graphql";
import {
  ProjectUpdateFieldInput,
  UPDATE_PROJECT_MUTATION,
} from "../graphql/mutations";

type UserOption = GqlUserShort & { displayName?: string | null };

const getUserLabel = (user: UserOption) => user.displayName || user.identifier;

const sameUserSet = (a: UserOption[] | null, b: UserOption[] | null) => {
  const x = (a || []).map((user) => user.id).sort();
  const y = (b || []).map((user) => user.id).sort();

  return x.length === y.length && x.join("\u0000") === y.join("\u0000");
};

const ownersDisplay = (owners: UserOption[] | null) => {
  if (!owners || owners.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        None
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {owners.map((owner) => (
        <UserAvatar
          key={owner.id}
          id={owner.id}
          identifier={owner.identifier}
        />
      ))}
    </Box>
  );
};

interface ProjectOverviewProps {
  project: GqlProject;
}

export const ProjectOverview = ({ project }: ProjectOverviewProps) => {
  const { ikApi } = useConfig();
  const { actions, refreshEntity } = useEntityProvider();
  const canEdit = actions.includes("edit");

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
      (project.owners || []).map((owner) => {
        const loadedUser = users.find((user) => user.id === owner.id);
        return loadedUser || owner;
      }),
    [project.owners, users],
  );

  return (
    <OverviewCard
      name={project.name}
      description={project.description || "No description"}
    >
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
            label="Name"
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={6}
      />
      <CommonField
        name={"Status"}
        value={<StatusChip status={project.status} />}
        size={6}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={project.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{project.description || "No description"}</span>}
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
      <CommonEditableField<string | null>
        name={"Workspace"}
        canEdit={canEdit}
        value={project.workspace?.id ?? null}
        ariaLabel="Edit workspace"
        display={
          project.workspace ? (
            <GetReferenceUrlValue
              {...project.workspace}
              entityName="workspaces"
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
            label="Workspace"
          />
        )}
        size={6}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={project.createdAt} user={project.creator} />}
        size={6}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={project.updatedAt} />}
        size={6}
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={project.labels || []}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={project.labels || []} />}
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
            label="Assigned Users"
            helperText="Optional users allowed to edit this project"
            options={users}
            getOptionLabel={getUserLabel}
          />
        )}
        size={6}
      />
    </OverviewCard>
  );
};
