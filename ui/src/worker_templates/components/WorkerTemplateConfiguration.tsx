import { useCallback, useEffect, useState } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { Button } from "../../ui";
import {
  GqlWorkerTemplate,
  UPDATE_WORKER_TEMPLATE_MUTATION,
  VALIDATE_WORKER_TEMPLATE_MUTATION,
  WorkerConfiguration,
} from "../graphql";

import { WorkerConfigurationForm } from "./WorkerConfigurationForm";

export interface WorkerTemplateConfigurationProps {
  workerTemplate: GqlWorkerTemplate;
}

export const WorkerTemplateConfiguration = ({
  workerTemplate,
}: WorkerTemplateConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:worker_template", "admin");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkerConfiguration>(
    workerTemplate.configuration,
  );
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(workerTemplate.configuration);
  }, [workerTemplate.configuration, editing]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await ikApi.graphqlRequest(UPDATE_WORKER_TEMPLATE_MUTATION, {
        id: workerTemplate.id,
        input: { configuration: draft },
      });
      notify("Worker template configuration updated", "success");
      setEditing(false);
      refreshEntity?.();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [ikApi, workerTemplate.id, draft, refreshEntity]);

  const validate = useCallback(async () => {
    setValidating(true);
    try {
      const response = await ikApi.graphqlRequest<{
        validateWorkerTemplate: { isValid: boolean; message: string | null };
      }>(VALIDATE_WORKER_TEMPLATE_MUTATION, { id: workerTemplate.id });
      const { isValid, message } = response.validateWorkerTemplate;
      notify(
        message || (isValid ? "Worker template is valid" : "Invalid"),
        isValid ? "success" : "error",
      );
    } catch (error) {
      notifyError(error);
    } finally {
      setValidating(false);
    }
  }, [ikApi, workerTemplate.id]);

  const actions = editing ? (
    <div className="flex gap-2">
      <Button
        onClick={() => {
          setDraft(workerTemplate.configuration);
          setEditing(false);
        }}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button variant="contained" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button onClick={validate} disabled={validating}>
        {validating ? "Validating..." : "Validate"}
      </Button>
      {canEdit && <Button onClick={() => setEditing(true)}>Edit</Button>}
    </div>
  );

  return (
    <BaseCard
      name="Configuration"
      description={
        editing
          ? "Changes apply to workers spawned from now on."
          : "Validate checks the configuration against the provider without starting a worker."
      }
      actions={actions}
    >
      <div className="col-span-full">
        <WorkerConfigurationForm
          value={draft}
          onChange={setDraft}
          disabled={!editing}
        />
      </div>
    </BaseCard>
  );
};
