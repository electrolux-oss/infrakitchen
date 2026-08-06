import { useCallback } from "react";

import { Checkbox, FormControlLabel, Typography } from "@mui/material";

import { getBooleanLabel } from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS } from "../constants";
import { GqlProject } from "../graphql";
import {
  ProjectUpdateFieldInput,
  UPDATE_PROJECT_MUTATION,
} from "../graphql/mutations";
import { ProjectConfig, ResourceUpdateApprovalBypassField } from "../types";

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
          allow_unapproved_metadata_edits: [],
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
      <CommonEditableField<ResourceUpdateApprovalBypassField[]>
        name={"Allow Update Without Approval"}
        canEdit={canEdit}
        value={project.configuration?.allow_unapproved_metadata_edits ?? []}
        ariaLabel="Edit allow unapproved resource update fields"
        display={
          (project.configuration?.allow_unapproved_metadata_edits ?? []).length
            ? (project.configuration?.allow_unapproved_metadata_edits ?? [])
                .map(
                  (field: string) =>
                    RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS.find(
                      (option) => option.value === field,
                    )?.label ?? field,
                )
                .join(", ")
            : "None"
        }
        onSave={(value) =>
          saveConfiguration({ allow_unapproved_metadata_edits: value })
        }
        renderEditor={({ value, onChange }) => (
          <>
            {RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={value.includes(option.value)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...value, option.value]
                          : value.filter((item) => item !== option.value),
                      )
                    }
                  />
                }
                label={option.label}
              />
            ))}
          </>
        )}
        isEqual={(a, b) =>
          a.length === b.length && a.every((value) => b.includes(value))
        }
        size={6}
      />
      <Typography variant="body2" color="text.secondary">
        Force resources in this project to use the assigned workspace.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Let users update selected resource fields without creating an approval
        request.
      </Typography>
    </OverviewCard>
  );
};
