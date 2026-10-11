import { useCallback } from "react";

import { Alert, Grid, TextField } from "@mui/material";

import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { CommonField } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import {
  GqlWorkerTemplate,
  UPDATE_WORKER_TEMPLATE_MUTATION,
  WorkerTemplateUpdateFieldInput,
} from "../graphql";
import { getWorkerProviderLabel } from "../providers";

interface WorkerTemplateOverviewProps {
  workerTemplate: GqlWorkerTemplate;
}

const NumberEditor = ({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) => (
  <TextField
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    slotProps={{ input: { "aria-label": label } }}
    fullWidth
    margin="normal"
    autoFocus
  />
);

export const WorkerTemplateOverview = ({
  workerTemplate,
}: WorkerTemplateOverviewProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, actions } = useEntityProvider();
  const canEdit = actions.includes("edit");

  const saveField = useCallback(
    async (input: WorkerTemplateUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_WORKER_TEMPLATE_MUTATION, {
          id: workerTemplate.id,
          input,
        });
        notify("Worker template updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, workerTemplate.id, refreshEntity],
  );

  return (
    <OverviewCard name={workerTemplate.name}>
      {workerTemplate.lastError && (
        <Grid size={12}>
          <Alert severity="error">{workerTemplate.lastError}</Alert>
        </Grid>
      )}
      <CommonField
        name="Provider"
        value={getWorkerProviderLabel(workerTemplate.provider)}
        size={6}
      />
      <CommonField
        name="Status"
        value={
          <StatusChip
            status={String(workerTemplate.status).toLowerCase()}
            state={String(workerTemplate.state).toLowerCase()}
          />
        }
        size={6}
      />
      <EditableDescriptionField
        value={workerTemplate.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <CommonEditableField<number>
        name="Max workers"
        canEdit={canEdit}
        value={workerTemplate.maxWorkers}
        ariaLabel="Edit max workers"
        display={<span>{workerTemplate.maxWorkers}</span>}
        onSave={(value) => saveField({ maxWorkers: value })}
        renderEditor={({ value, onChange }) => (
          <NumberEditor value={value} onChange={onChange} label="Max workers" />
        )}
        size={4}
      />
      <CommonEditableField<number>
        name="Idle timeout (seconds)"
        canEdit={canEdit}
        value={workerTemplate.idleTimeoutSeconds}
        ariaLabel="Edit idle timeout"
        display={<span>{workerTemplate.idleTimeoutSeconds}</span>}
        onSave={(value) => saveField({ idleTimeoutSeconds: value })}
        renderEditor={({ value, onChange }) => (
          <NumberEditor
            value={value}
            onChange={onChange}
            label="Idle timeout"
          />
        )}
        size={4}
      />
      <CommonEditableField<number>
        name="Priority"
        canEdit={canEdit}
        value={workerTemplate.priority}
        ariaLabel="Edit priority"
        display={<span>{workerTemplate.priority}</span>}
        onSave={(value) => saveField({ priority: value })}
        renderEditor={({ value, onChange }) => (
          <NumberEditor value={value} onChange={onChange} label="Priority" />
        )}
        size={4}
      />
      <CommonField
        name="Created"
        value={<RelativeTime date={workerTemplate.createdAt} />}
        size={6}
      />
      <CommonField
        name="Last Updated"
        value={<RelativeTime date={workerTemplate.updatedAt} />}
        size={6}
      />
    </OverviewCard>
  );
};
