import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Labels } from "../../common/components/labels/Labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { Alert, TextField } from "../../ui";
import {
  GqlWorkerTemplate,
  UPDATE_WORKER_TEMPLATE_MUTATION,
  WorkerTemplateUpdateFieldInput,
} from "../graphql";

const formatDuration = (seconds: number) =>
  seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;

interface NumberFieldProps {
  name: string;
  value: number;
  canEdit: boolean;
  min: number;
  display?: string;
  onSave: (value: number) => Promise<void>;
}

const EditableNumberField = ({
  name,
  value,
  canEdit,
  min,
  display,
  onSave,
}: NumberFieldProps) => (
  <CommonEditableField<number>
    name={name}
    span="half"
    canEdit={canEdit}
    value={value}
    display={display ?? String(value)}
    ariaLabel={`Edit ${name.toLowerCase()}`}
    onSave={async (next) => {
      if (!Number.isInteger(next) || next < min) {
        throw new Error(`${name} must be a whole number of at least ${min}`);
      }
      await onSave(next);
    }}
    renderEditor={({ value: current, onChange }) => (
      <TextField
        type="number"
        size="small"
        value={Number.isNaN(current) ? "" : current}
        onChange={(event) => onChange(Number(event.target.value))}
        inputProps={{ min, step: 1 }}
        autoFocus
        fullWidth
      />
    )}
  />
);

export interface WorkerTemplateSidebarProps {
  workerTemplate: GqlWorkerTemplate;
}

export const WorkerTemplateSidebar = ({
  workerTemplate,
}: WorkerTemplateSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:worker_template", "admin");

  const saveField = useEntityFieldSaver<WorkerTemplateUpdateFieldInput>(
    UPDATE_WORKER_TEMPLATE_MUTATION,
    workerTemplate.id,
    "Worker template",
  );

  return (
    <EntitySidebar ariaLabel="Worker template details">
      {workerTemplate.lastError && (
        <div className="p-4 pb-0">
          <Alert severity="warning" className="[word-break:break-word]">
            {workerTemplate.lastError}
          </Alert>
        </div>
      )}
      <SidebarSection title="About">
        <EditableDescriptionField
          value={workerTemplate.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Provider"
          value={getProviderValue(workerTemplate.provider, 18)}
          span="half"
        />
        <CommonField
          name="Revision"
          value={workerTemplate.revisionNumber}
          span="half"
        />
      </SidebarSection>

      <SidebarSection title="Scaling">
        <EditableNumberField
          name="Max workers"
          value={workerTemplate.maxWorkers}
          min={1}
          canEdit={canEdit}
          onSave={(value) => saveField({ maxWorkers: value })}
        />
        <EditableNumberField
          name="Priority"
          value={workerTemplate.priority}
          min={-1000}
          canEdit={canEdit}
          onSave={(value) => saveField({ priority: value })}
        />
        <EditableNumberField
          name="Idle timeout (seconds)"
          value={workerTemplate.idleTimeoutSeconds}
          display={formatDuration(workerTemplate.idleTimeoutSeconds)}
          min={30}
          canEdit={canEdit}
          onSave={(value) => saveField({ idleTimeoutSeconds: value })}
        />
      </SidebarSection>

      <SidebarSection>
        <EditableTagsField
          name="Labels"
          value={workerTemplate.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
          helperText="Add labels and press Enter"
          display={
            workerTemplate.labels && workerTemplate.labels.length > 0 ? (
              <Labels labels={workerTemplate.labels} />
            ) : (
              <PlaceholderText />
            )
          }
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={workerTemplate.createdAt} />}
          span="half"
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={workerTemplate.updatedAt} />}
          span="half"
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
