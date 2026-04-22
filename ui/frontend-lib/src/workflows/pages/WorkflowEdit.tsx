import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useParams } from "react-router";

import { json as jsonLang } from "@codemirror/lang-json";
import { lintGutter } from "@codemirror/lint";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormLabel,
  TextField,
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
import { WorkflowResponse, WorkflowStepResponse } from "../types";

// ── JSON editor (kept local to avoid cross-module churn) ──────────────────

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
    // Only re-sync when the underlying object reference changes.
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

// ── Page state types ──────────────────────────────────────────────────────

interface StepDraft {
  id: string;
  template_id: string;
  template_name: string;
  position: number;
  source_code_version_id: string | null;
  integration_ids: string[];
  secret_ids: string[];
  storage_id: string | null;
  parent_resource_ids: string[];
  resolved_variables: Record<string, any>;
}

function stepToDraft(step: WorkflowStepResponse): StepDraft {
  return {
    id: step.id,
    template_id: step.template_id,
    template_name: step.template?.name ?? step.template_id.slice(0, 8),
    position: step.position,
    source_code_version_id: step.source_code_version_id,
    integration_ids: step.integration_ids.map((i) => i.id),
    secret_ids: step.secret_ids.map((s) => s.id),
    storage_id: step.storage_id,
    parent_resource_ids: step.parent_resource_ids,
    resolved_variables: step.resolved_variables,
  };
}

// ── Page component ────────────────────────────────────────────────────────

export const WorkflowEditPage = () => {
  const { workflow_id } = useParams();
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [scvsByTemplate, setScvsByTemplate] = useState<
    Record<string, IkEntity[]>
  >({});
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  // ── Load workflow ───────────────────────────────────────────────────
  useEffect(() => {
    if (!workflow_id) return;
    setLoading(true);
    setError(null);
    ikApi
      .get(`workflows/${workflow_id}`)
      .then((wf: WorkflowResponse) => {
        setWorkflow(wf);
        setSteps(
          wf.steps.map(stepToDraft).sort((a, b) => a.position - b.position),
        );
      })
      .catch((e: any) => setError(e.message || "Failed to load workflow"))
      .finally(() => setLoading(false));
  }, [workflow_id, ikApi]);

  // ── Load SCV options per template ───────────────────────────────────
  useEffect(() => {
    if (!workflow || steps.length === 0) return;
    const templateIds = [...new Set(steps.map((s) => s.template_id))];

    (async () => {
      try {
        const result = await ikApi.getList("source_code_versions", {
          pagination: { page: 1, perPage: 500 },
          sort: { field: "updated_at", order: "DESC" },
          filter: { template_id: templateIds },
        });
        const map: Record<string, IkEntity[]> = {};
        for (const tid of templateIds) map[tid] = [];
        for (const scv of result.data || []) {
          const tid = scv.template_id || scv.template?.id;
          if (tid && map[tid]) map[tid].push(scv);
        }
        setScvsByTemplate(map);
      } catch (e: any) {
        notifyError(e);
      }
    })();
    // Re-run only when the workflow identity or template set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, ikApi]);

  // ── Per-step updaters ───────────────────────────────────────────────
  const updateStep = useCallback(
    (stepId: string, patch: Partial<StepDraft>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const canEdit =
    workflow?.status === "pending" || workflow?.status === "error";

  const commonIntegrationIds = useMemo(() => {
    if (steps.length === 0) return [];
    return steps[0].integration_ids;
  }, [steps]);

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!workflow_id || !workflow) return;
    setSubmitting(true);
    try {
      const payload = {
        steps: steps.map((s) => ({
          id: s.id,
          resolved_variables: s.resolved_variables,
          source_code_version_id: s.source_code_version_id,
          integration_ids: s.integration_ids,
          secret_ids: s.secret_ids,
          storage_id: s.storage_id,
          parent_resource_ids: s.parent_resource_ids,
        })),
      };
      const response: WorkflowResponse = await ikApi.patchRaw(
        `workflows/${workflow_id}`,
        payload,
      );
      notify("Workflow updated", "success");
      navigate(`${linkPrefix}workflows/${response.id}`);
    } catch (e: any) {
      notifyError(e);
    } finally {
      setSubmitting(false);
    }
  }, [workflow_id, workflow, steps, ikApi, navigate, linkPrefix]);

  // ── Render: loading / error ─────────────────────────────────────────
  if (loading) {
    return (
      <PageContainer
        title="Edit Workflow"
        onBack={() => navigate(`${linkPrefix}workflows`)}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
          }}
        >
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (error || !workflow) {
    return (
      <PageContainer
        title="Edit Workflow"
        onBack={() => navigate(`${linkPrefix}workflows`)}
      >
        <Alert severity="error">{error || "Workflow not found"}</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`Edit Workflow ${workflow.id.slice(0, 8)}…`}
      onBack={() => navigate(`${linkPrefix}workflows/${workflow_id}`)}
      backAriaLabel="Back to workflow"
      bottomActions={
        <>
          <Button
            variant="outlined"
            onClick={() => navigate(`${linkPrefix}workflows/${workflow_id}`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={submitting || !canEdit}
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {!canEdit && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This workflow cannot be edited. Only pending or errored workflows are
          editable. Current status: <StatusChip status={workflow.status} />
        </Alert>
      )}

      {/* Per-step sections */}
      {steps.map((step, idx) => {
        const scvs = scvsByTemplate[step.template_id] || [];
        const currentScv =
          scvs.find((s) => s.id === step.source_code_version_id) || null;

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
                <span>{step.template_name}</span>
              </Box>
            }
          >
            <Autocomplete
              options={scvs}
              getOptionLabel={(opt: IkEntity) =>
                opt.source_code_version || opt.name || opt.id
              }
              value={currentScv}
              onChange={(_e, newVal) =>
                updateStep(step.id, {
                  source_code_version_id: newVal?.id || null,
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Template Version"
                  margin="normal"
                  helperText={
                    scvs.length === 0
                      ? "No source code versions found"
                      : "Select the template version to use"
                  }
                />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              fullWidth
              disabled={!canEdit}
            />

            <ArrayReferenceInput
              ikApi={ikApi}
              entity_name="integrations"
              filter={{ integration_type: "cloud" }}
              showFields={["integration_provider", "name"]}
              buffer={buffer}
              setBuffer={setBuffer}
              error={false}
              helpertext="Cloud integrations for this step"
              value={step.integration_ids}
              label="Cloud Integrations"
              multiple
              fullWidth
              bufferKey={`integrations_${step.id}`}
              disabled={!canEdit}
              onChange={(ids: string[]) =>
                updateStep(step.id, { integration_ids: ids })
              }
            />

            <ArrayReferenceInput
              ikApi={ikApi}
              entity_name="secrets"
              showFields={["name", "secret_provider"]}
              buffer={buffer}
              setBuffer={setBuffer}
              error={false}
              helpertext="Secrets for this step"
              value={step.secret_ids}
              label="Secrets"
              multiple
              fullWidth
              bufferKey={`secrets_${step.id}`}
              disabled={!canEdit}
              onChange={(ids: string[]) =>
                updateStep(step.id, { secret_ids: ids })
              }
            />

            <ReferenceInput
              ikApi={ikApi}
              entity_name="storages"
              buffer={buffer}
              showFields={["name", "storage_provider"]}
              setBuffer={setBuffer}
              error={false}
              helpertext="Storage for TF state"
              filter={
                step.integration_ids.length > 0
                  ? { integration_id: step.integration_ids }
                  : undefined
              }
              value={step.storage_id}
              label="Storage for TF State"
              bufferKey={`storage_${step.id}`}
              disabled={!canEdit}
              onChange={(val: string | null) =>
                updateStep(step.id, { storage_id: val })
              }
            />

            <ArrayReferenceInput
              ikApi={ikApi}
              entity_name="resources"
              bufferKey={`parents_${step.id}`}
              buffer={buffer}
              setBuffer={setBuffer}
              showFields={["template.name", "name"]}
              fields={[
                "name",
                "template",
                "integration_ids",
                "storage",
                "workspace",
                "secret_ids",
                "id",
              ]}
              error={false}
              helpertext="Parent resources for this step"
              filter={
                commonIntegrationIds.length > 0
                  ? { integration_ids__any: commonIntegrationIds }
                  : undefined
              }
              value={step.parent_resource_ids}
              label="Parent Resources"
              multiple
              fullWidth
              disabled={!canEdit}
              onChange={(ids: string[]) =>
                updateStep(step.id, { parent_resource_ids: ids })
              }
            />

            <JsonField
              label="Resolved Variables"
              value={step.resolved_variables}
              onChange={(val) =>
                updateStep(step.id, { resolved_variables: val })
              }
              helperText="Final variable values passed to the template at execution time."
            />
          </PropertyCard>
        );
      })}
    </PageContainer>
  );
};

WorkflowEditPage.path = "/workflows/:workflow_id/edit";
