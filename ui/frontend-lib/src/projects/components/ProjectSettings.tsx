import { useCallback } from "react";

import { Checkbox, FormControlLabel, Typography } from "@mui/material";

import { getBooleanLabel } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { GqlProject } from "../graphql";
import {
  ProjectUpdateFieldInput,
  UPDATE_PROJECT_MUTATION,
} from "../graphql/mutations";
import { ProjectConfig } from "../types";

interface ProjectSettingsProps {
  project: GqlProject;
}

export const ProjectSettings = ({ project }: ProjectSettingsProps) => {
  const { ikApi } = useConfig();
  const { actions, refreshEntity } = useEntityProvider();
  const canEdit = actions.includes("edit");

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

  const saveConfiguration = useCallback(
    (partial: Partial<ProjectConfig>) =>
      saveField({
        configuration: {
          always_use_workspace: false,
          ...(project.configuration || {}),
          ...partial,
        },
      }),
    [project.configuration, saveField],
  );

  return (
    <OverviewCard name="Project Configuration">
      <CommonEditableField<boolean>
        name={"Always Use Workspace"}
        canEdit={canEdit}
        value={project.configuration?.always_use_workspace ?? false}
        ariaLabel="Edit always use workspace"
        display={getBooleanLabel(
          project.configuration?.always_use_workspace ?? false,
        )}
        onSave={(value) => saveConfiguration({ always_use_workspace: value })}
        renderEditor={({ value, onChange }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
              />
            }
            label="Always use workspace"
          />
        )}
        size={6}
      />
      <Typography variant="body2" color="text.secondary">
        Force resources in this project to use the assigned workspace.
      </Typography>
    </OverviewCard>
  );
};
