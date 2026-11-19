import { useCallback } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import {
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
} from "../../ui";
import {
  DRIFT_DETECTION_OPTIONS,
  DriftDetectionMode,
  fromDriftDetectionMode,
  RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS,
  toDriftDetectionMode,
} from "../constants";
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

  const driftMode = toDriftDetectionMode(
    project.configuration?.drift_detection,
  );

  return (
    <BaseCard name="Project Configuration">
      <BooleanInlineField
        name={"Always Use Workspace"}
        info="Force resources in this project to use the assigned workspace."
        canEdit={canEdit}
        value={project.configuration?.always_use_workspace ?? false}
        ariaLabel="Edit always use workspace"
        onSave={(value) => saveConfiguration({ always_use_workspace: value })}
        span="half"
      />
      <CommonEditableField<ResourceUpdateApprovalBypassField[]>
        name={"Fields Editable Without Approval"}
        info="Users can update the selected resource fields without creating an approval request."
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
          <div className="grid grid-cols-2">
            {RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS.map((option) => (
              <FormControlLabel
                key={option.value}
                className="-ml-[3.5px]"
                control={
                  <Switch
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
          </div>
        )}
        isEqual={(a, b) =>
          a.length === b.length && a.every((value) => b.includes(value))
        }
        span="half"
      />
      <CommonEditableField<DriftDetectionMode>
        name={"Drift Detection"}
        info="Turn scheduled drift checks on or off for this project regardless of the global setting. The check interval is set globally."
        canEdit={canEdit}
        value={driftMode}
        ariaLabel="Edit drift detection"
        display={
          driftMode === "inherit" ? (
            <PlaceholderText text="Global setting" />
          ) : (
            DRIFT_DETECTION_OPTIONS.find((option) => option.value === driftMode)
              ?.label
          )
        }
        onSave={(value) =>
          saveConfiguration({ drift_detection: fromDriftDetectionMode(value) })
        }
        renderEditor={({ value, onChange }) => (
          <FormControl fullWidth>
            <Select
              value={value}
              variant="outlined"
              onChange={(event) =>
                onChange(event.target.value as DriftDetectionMode)
              }
            >
              {DRIFT_DETECTION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        span="half"
      />
    </BaseCard>
  );
};
