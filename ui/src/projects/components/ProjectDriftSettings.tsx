import { useCallback } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { TextField } from "../../ui";
import {
  DEFAULT_DRIFT_BATCH_SIZE,
  DEFAULT_DRIFT_INTERVAL_HOURS,
} from "../constants";
import { GqlProject } from "../graphql";
import {
  ProjectUpdateFieldInput,
  UPDATE_PROJECT_MUTATION,
} from "../graphql/mutations";
import { ProjectConfig } from "../types";

interface ProjectDriftSettingsProps {
  project: GqlProject;
}

export const ProjectDriftSettings = ({
  project,
}: ProjectDriftSettingsProps) => {
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
    <BaseCard name="Drift Detection">
      <BooleanInlineField
        name={"Drift Detection"}
        canEdit={canEdit}
        value={project.configuration?.drift_detection ?? false}
        ariaLabel="Edit drift detection"
        onSave={(value) => saveConfiguration({ drift_detection: value })}
        span="half"
      />
      <CommonEditableField<string>
        name={"Drift Check Frequency (hours)"}
        canEdit={canEdit}
        value={String(
          project.configuration?.drift_interval_hours ??
            DEFAULT_DRIFT_INTERVAL_HOURS,
        )}
        ariaLabel="Edit drift check frequency"
        display={
          project.configuration?.drift_interval_hours ? (
            `Every ${project.configuration.drift_interval_hours} hours`
          ) : (
            <PlaceholderText text="Global setting" />
          )
        }
        onSave={(value) =>
          saveConfiguration({
            drift_interval_hours: value === "" ? null : Number(value),
          })
        }
        renderEditor={({ value, onChange }) => (
          <TextField
            type="number"
            value={value}
            helperText="Defaults to 24 hours. Clear the field to use the global setting."
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        span="half"
      />
      <CommonEditableField<string>
        name={"Drift Checks Per Run"}
        canEdit={canEdit}
        value={String(
          project.configuration?.drift_batch_size ?? DEFAULT_DRIFT_BATCH_SIZE,
        )}
        ariaLabel="Edit drift checks per run"
        display={
          project.configuration?.drift_batch_size ? (
            `${project.configuration.drift_batch_size} resources`
          ) : (
            <PlaceholderText text="Global setting" />
          )
        }
        onSave={(value) =>
          saveConfiguration({
            drift_batch_size: value === "" ? null : Number(value),
          })
        }
        renderEditor={({ value, onChange }) => (
          <TextField
            type="number"
            value={value}
            helperText="Defaults to 20. Clear the field to share the global batch."
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        span="half"
      />
      <p className="m-0 text-body2 text-fg-muted">
        Regularly check the resources of this project for drift. Frequency and
        checks per run override the global drift settings.
      </p>
    </BaseCard>
  );
};
