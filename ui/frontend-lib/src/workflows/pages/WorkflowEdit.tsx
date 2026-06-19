import { useCallback, useEffect, useMemo, useState } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { json as jsonLang } from "@codemirror/lang-json";
import { lintGutter } from "@codemirror/lint";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormLabel,
  Typography,
  useColorScheme,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { IkEntity } from "../../types";
import { WorkflowStep } from "../components/WorkflowStep";
import {
  GqlWorkflow,
  GqlWorkflowStep,
  UPDATE_WORKFLOW_MUTATION,
  WORKFLOW_QUERY,
} from "../graphql";

interface JsonFieldProps {
  label: string;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  helperText?: string;
}

const JsonField = ({ label, value, onChange, helperText }: JsonFieldProps) => {
  const { mode } = useColorScheme();
  const [text, setText] = useState<string>(() =>
    JSON.stringify(value ?? {}, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value ?? {}, null, 2));
    setError(null);
  }, [value]);

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      try {
        const parsed = next.trim() === "" ? {} : JSON.parse(next);
        onChange(parsed);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [onChange],
  );

  return (
    <FormControl fullWidth margin="normal" error={!!error}>
      <FormLabel>{label}</FormLabel>
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
        <CodeMirror
          basicSetup={{ lineNumbers: true, foldGutter: false }}
          extensions={[jsonLang(), lintGutter()]}
          value={text}
          onChange={handleChange}
          theme={mode === "dark" ? "dark" : "light"}
        />
      </Box>
      {(error || helperText) && (
        <Typography
          variant="caption"
          color={error ? "error" : "text.secondary"}
          sx={{ mt: 0.5 }}
        >
          {error ?? helperText}
        </Typography>
      )}
    </FormControl>
  );
};

interface StepFormValues {
  id: string;
  sourceCodeVersionId: string | null;
  integrationIds: string[];
  secretIds: string[];
  storageId: string | null;
  parentResourceIds: string[];
  resolvedVariables: Record<string, any>;
}

interface WorkflowFormValues {
  steps: StepFormValues[];
}

function stepToFormValues(step: GqlWorkflowStep): StepFormValues {
  return {
    id: step.id,
    sourceCodeVersionId: step.sourceCodeVersion?.id ?? null,
    integrationIds: step.integrationIds?.map((i) => i.id) ?? [],
    secretIds: step.secretIds?.map((s) => s.id) ?? [],
    storageId: step.storageId ?? null,
    parentResourceIds: step.parentResourceIds?.map((r) => r.id) ?? [],
    resolvedVariables: step.resolvedVariables ?? {},
  };
}

const WorkflowEditPageInner = (props: { workflow: GqlWorkflow }) => {
  const { workflow } = props;
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}workflows/${workflow.id}`);

  const sortedSteps = useMemo(
    () => [...workflow.steps].sort((a, b) => a.position - b.position),
    [workflow.steps],
  );

  const methods = useForm<WorkflowFormValues>({
    mode: "onChange",
    defaultValues: {
      steps: sortedSteps.map(stepToFormValues),
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty, isSubmitting },
  } = methods;

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const canEdit = workflow.status === "pending" || workflow.status === "error";

  const watchedSteps = watch("steps");

  const commonIntegrationIds = useMemo(() => {
    if (!watchedSteps || watchedSteps.length === 0) return [];
    return watchedSteps[0].integrationIds;
  }, [watchedSteps]);

  const onSubmit = useCallback(
    async (data: WorkflowFormValues) => {
      if (!isDirty) {
        notify("No changes detected", "info");
        return;
      }

      try {
        const response = await ikApi.graphqlRequest<{
          updateWorkflow: GqlWorkflow;
        }>(UPDATE_WORKFLOW_MUTATION, {
          id: workflow.id,
          input: {
            steps: data.steps.map((s) => ({
              id: s.id,
              resolvedVariables: s.resolvedVariables,
              sourceCodeVersionId: s.sourceCodeVersionId,
              integrationIds: s.integrationIds,
              secretIds: s.secretIds,
              storageId: s.storageId,
              parentResourceIds: s.parentResourceIds,
            })),
          },
        });
        notify("Workflow updated", "success");
        navigate(`${linkPrefix}workflows/${response.updateWorkflow.id}`);
      } catch (e: any) {
        notifyError(e);
      }
    },
    [workflow.id, isDirty, ikApi, navigate, linkPrefix],
  );

  return (
    <FormProvider {...methods}>
      <PageContainer
        title={`Edit Workflow ${workflow.id.slice(0, 8)}…`}
        onBack={handleBack}
        backAriaLabel="Back to workflow"
        bottomActions={
          <>
            <Button variant="outlined" onClick={handleBack}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || !canEdit}
            >
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        {!canEdit && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This workflow cannot be edited. Only pending or errored workflows
            are editable. Current status:{" "}
            <StatusChip status={workflow.status} />
          </Alert>
        )}

        {sortedSteps.map((step, idx) => {
          if (step.status === "done") {
            return (
              <WorkflowStep
                key={step.id}
                step={step}
                workflowAction={workflow.action}
              />
            );
          }

          const stepIntegrations = watchedSteps?.[idx]?.integrationIds || [];

          return (
            <PropertyCard
              key={step.id}
              title={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={idx + 1}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 700, minWidth: 28 }}
                  />
                  <span>
                    {step.template?.name ?? step.template.id.slice(0, 8)}
                  </span>
                </Box>
              }
            >
              <Controller
                name={`steps.${idx}.sourceCodeVersionId`}
                control={control}
                render={({ field }) => (
                  <ReferenceInput
                    {...field}
                    ikApi={ikApi}
                    entity_name="source_code_versions"
                    buffer={buffer}
                    setBuffer={setBuffer}
                    showFields={["source_code_version", "identifier"]}
                    error={false}
                    helpertext="Select the template version to use"
                    filter={{ template_id: step.template.id }}
                    value={field.value}
                    label="Template Version"
                    bufferKey={`source_code_versions_${step.id}`}
                    disabled={!canEdit}
                    fullWidth
                  />
                )}
              />

              <Controller
                name={`steps.${idx}.integrationIds`}
                control={control}
                render={({ field }) => (
                  <ArrayReferenceInput
                    ikApi={ikApi}
                    entity_name="integrations"
                    filter={{ integration_type: "cloud" }}
                    showFields={["integrationProvider", "name"]}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    error={false}
                    helpertext="Cloud integrations for this step"
                    value={field.value}
                    label="Cloud Integrations"
                    multiple
                    fullWidth
                    bufferKey={`integrations_${step.id}`}
                    disabled={!canEdit}
                    onChange={(ids: string[]) => field.onChange(ids)}
                  />
                )}
              />

              <Controller
                name={`steps.${idx}.secretIds`}
                control={control}
                render={({ field }) => (
                  <ArrayReferenceInput
                    ikApi={ikApi}
                    entity_name="secrets"
                    showFields={["name", "secretProvider"]}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    error={false}
                    helpertext="Secrets for this step"
                    value={field.value}
                    label="Secrets"
                    multiple
                    fullWidth
                    bufferKey={`secrets_${step.id}`}
                    disabled={!canEdit}
                    onChange={(ids: string[]) => field.onChange(ids)}
                  />
                )}
              />

              <Controller
                name={`steps.${idx}.storageId`}
                control={control}
                render={({ field }) => (
                  <ReferenceInput
                    ikApi={ikApi}
                    entity_name="storages"
                    buffer={buffer}
                    showFields={["name", "storage_provider"]}
                    setBuffer={setBuffer}
                    error={false}
                    helpertext="Storage for TF state"
                    filter={
                      stepIntegrations.length > 0
                        ? { integration_id: stepIntegrations }
                        : undefined
                    }
                    value={field.value}
                    label="Storage for TF State"
                    bufferKey={`storage_${step.id}`}
                    disabled={!canEdit}
                    onChange={(val: string | null) => field.onChange(val)}
                  />
                )}
              />

              <Controller
                name={`steps.${idx}.parentResourceIds`}
                control={control}
                render={({ field }) => (
                  <ArrayReferenceInput
                    ikApi={ikApi}
                    entity_name="resources"
                    bufferKey={`parents_${step.id}`}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    showFields={["template.name", "name"]}
                    fields={[
                      "name",
                      "template.id",
                      "template.name",
                      "integrationIds.id",
                      "integrationIds.name",
                      "storage.id",
                      "storage.name",
                      "workspace.id",
                      "workspace.name",
                      "secretIds.id",
                      "secretIds.name",
                      "id",
                    ]}
                    error={false}
                    helpertext="Parent resources for this step"
                    filter={
                      commonIntegrationIds.length > 0
                        ? {
                            integration_ids__any: commonIntegrationIds,
                          }
                        : undefined
                    }
                    value={field.value}
                    label="Parent Resources"
                    multiple
                    fullWidth
                    disabled={!canEdit}
                    onChange={(ids: string[]) => field.onChange(ids)}
                  />
                )}
              />

              <Controller
                name={`steps.${idx}.resolvedVariables`}
                control={control}
                render={({ field }) => (
                  <JsonField
                    label="Resolved Variables"
                    value={field.value}
                    onChange={(val) => field.onChange(val)}
                    helperText="Final variable values passed to the template at execution time."
                  />
                )}
              />
            </PropertyCard>
          );
        })}
      </PageContainer>
    </FormProvider>
  );
};

export const WorkflowEditPage = () => {
  const { workflow_id } = useParams();
  const { ikApi } = useConfig();

  const [workflow, setWorkflow] = useState<GqlWorkflow>();
  const [error, setError] = useState<Error>();

  const getWorkflow = useCallback(async () => {
    if (!workflow_id) {
      setError(new Error("Workflow id is required"));
      return;
    }

    await ikApi
      .graphqlRequest<{
        workflow: GqlWorkflow | null;
      }>(WORKFLOW_QUERY, { id: workflow_id })
      .then((response) => {
        if (!response.workflow) {
          throw new Error("Workflow not found");
        }
        setWorkflow(response.workflow);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, workflow_id]);

  useEffectOnce(() => {
    getWorkflow();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {workflow && <WorkflowEditPageInner workflow={workflow} />}
    </>
  );
};

WorkflowEditPage.path = "/workflows/:workflow_id/edit";
