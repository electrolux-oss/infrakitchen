import { useCallback } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { Checkbox, FormControlLabel } from "../../ui";
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
  const { actions } = useEntityProvider();
  const canEdit = actions.includes("edit");

  const saveField = useEntityFieldSaver<ProjectUpdateFieldInput>(
    UPDATE_PROJECT_MUTATION,
    project.id,
    "Project",
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
    <BaseCard name="Project Configuration">
      <BooleanInlineField
        name={"Always Use Workspace"}
        canEdit={canEdit}
        value={project.configuration?.always_use_workspace ?? false}
        ariaLabel="Edit always use workspace"
        onSave={(value) => saveConfiguration({ always_use_workspace: value })}
        span="half"
      />
      <CommonEditableField<ResourceUpdateApprovalBypassField[]>
        name={"Allow Update Without Approval"}
        canEdit={canEdit}
        value={project.configuration?.allow_unapproved_metadata_edits ?? []}
        ariaLabel="Edit allow unapproved resource update fields"
        display={
          (project.configuration?.allow_unapproved_metadata_edits ?? [])
            .length ? (
            (project.configuration?.allow_unapproved_metadata_edits ?? [])
              .map(
                (field: string) =>
                  RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS.find(
                    (option) => option.value === field,
                  )?.label ?? field,
              )
              .join(", ")
          ) : (
            <PlaceholderText />
          )
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
        span="half"
      />
      <p className="m-0 text-body2 text-fg-muted">
        Force resources in this project to use the assigned workspace.
      </p>
      <p className="m-0 text-body2 text-fg-muted">
        Let users update selected resource fields without creating an approval
        request.
      </p>
    </BaseCard>
  );
};
