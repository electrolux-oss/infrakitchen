import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useParams } from "react-router";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { ResourceVariableRow } from "../../resources/components/variables/ResourceVariablesForm";
import { ResourceVariableSchema } from "../../resources/types";
import { TemplateResponse, TemplateShort } from "../../templates/types";
import { IkEntity } from "../../types";
import { BlueprintResponse, WiringRule } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

interface WiredInfo {
  sourceTemplateName: string;
  sourceOutput: string;
  /** True when this is an input→input link (not an output→input wire) */
  isInputWire: boolean;
  /** True when this is a constant→input wire */
  isConstantWire: boolean;
  /** The constant ID (only set for constant wires) */
  constantId?: string;
}

function computeWiredVariables(
  wiring: WiringRule[],
  templates: Array<{ id: string; name: string }>,
  constants: Array<{ id: string; name: string }> = [],
): Record<string, Record<string, WiredInfo>> {
  const nameMap = new Map(templates.map((t) => [t.id, t.name]));
  const constantMap = new Map(constants.map((c) => [c.id, c]));
  const result: Record<string, Record<string, WiredInfo>> = {};
  for (const w of wiring) {
    if (!result[w.target_template_id]) result[w.target_template_id] = {};
    const constant = constantMap.get(w.source_template_id);
    const isConstantWire = !!constant;
    const isInputWire = !isConstantWire && w.source_output.startsWith("input:");
    result[w.target_template_id][w.target_variable] = {
      sourceTemplateName: isConstantWire
        ? constant.name || "Constant"
        : nameMap.get(w.source_template_id) || "Unknown",
      sourceOutput: isConstantWire
        ? constant.name || "value"
        : isInputWire
          ? w.source_output.slice(6)
          : w.source_output,
      isInputWire,
      isConstantWire,
      constantId: isConstantWire ? constant.id : undefined,
    };
  }
  return result;
}

function computeMissingParents(
  templateDetails: Record<string, TemplateResponse>,
  blueprintTemplateIds: Set<string>,
): Record<string, TemplateShort[]> {
  const result: Record<string, TemplateShort[]> = {};
  for (const [id, details] of Object.entries(templateDetails)) {
    const missing = (details.parents || []).filter(
      (p) => !blueprintTemplateIds.has(p.id),
    );
    if (missing.length > 0) result[id] = missing;
  }
  return result;
}

// ── Page Component ─────────────────────────────────────────────────────────

export const BlueprintUsePage = () => {
  const { blueprint_id } = useParams();
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  // ── Loading / submission state ────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Blueprint data ────────────────────────────────────────────────────
  const [blueprint, setBlueprint] = useState<BlueprintResponse | null>(null);
  const [templateDetails, setTemplateDetails] = useState<
    Record<string, TemplateResponse>
  >({});
  const [scvsByTemplate, setScvsByTemplate] = useState<
    Record<string, IkEntity[]>
  >({});
  const [selectedScv, setSelectedScv] = useState<Record<string, string>>({});
  const [variableSchemas, setVariableSchemas] = useState<
    Record<string, ResourceVariableSchema[]>
  >({});
  const [variableValues, setVariableValues] = useState<
    Record<string, Record<string, any>>
  >({});

  // ── Parent selections (for templates with missing parents) ────────────
  const [parentSelections, setParentSelections] = useState<
    Record<string, Record<string, string[]>>
  >({});

  // ── Toggle to hide variables that already have default values ─────────
  const [hideDefaults, setHideDefaults] = useState(true);

  // ── Common configuration ──────────────────────────────────────────────
  const [integrationIds, setIntegrationIds] = useState<string[]>([]);
  const [storageId, setStorageId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [secretIds, setSecretIds] = useState<string[]>([]);
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  // ── Load blueprint ───────────────────────────────────────────────────
  useEffect(() => {
    if (!blueprint_id) return;
    setLoading(true);
    setError(null);
    ikApi
      .get(`blueprints/${blueprint_id}`)
      .then((bp: BlueprintResponse) => setBlueprint(bp))
      .catch((e: any) => setError(e.message || "Failed to load blueprint"))
      .finally(() => setLoading(false));
  }, [blueprint_id, ikApi]);

  // ── Load template details (needed immediately for parent info) ───────
  useEffect(() => {
    if (!blueprint || blueprint.templates.length === 0) return;

    const load = async () => {
      try {
        const templateIds = blueprint.templates.map((t) => t.id);
        const detailsList = await ikApi.getList("templates", {
          pagination: { page: 1, perPage: templateIds.length },
          sort: { field: "name", order: "ASC" },
          filter: { id: templateIds },
        });

        const detailsMap: Record<string, TemplateResponse> = {};
        for (const t of detailsList.data || []) {
          detailsMap[t.id] = t as unknown as TemplateResponse;
        }
        setTemplateDetails(detailsMap);
      } catch (e: any) {
        notifyError(e);
      }
    };

    load();
  }, [blueprint, ikApi]);

  // ── Load variable schemas when SCVs are selected ─────────────────────
  useEffect(() => {
    if (Object.keys(selectedScv).length === 0) return;

    const load = async () => {
      const schemas: Record<string, ResourceVariableSchema[]> = {};
      const defaults: Record<string, Record<string, any>> = {};

      await Promise.all(
        Object.entries(selectedScv).map(async ([templateId, scvId]) => {
          if (!scvId) return;
          try {
            const parentIds = Object.values(
              parentSelections[templateId] || {},
            ).flat();
            const schema = await ikApi.getVariableSchema(scvId, parentIds);
            schemas[templateId] = schema.sort((a, b) => {
              if (a.required !== b.required) return b.required ? 1 : -1;
              return a.index - b.index;
            });
            defaults[templateId] = {};
            for (const v of schema) {
              if (v.value !== null && v.value !== undefined) {
                defaults[templateId][v.name] = v.value;
              }
            }
          } catch {
            schemas[templateId] = [];
            defaults[templateId] = {};
          }
        }),
      );

      setVariableSchemas(schemas);
      setVariableValues((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(defaults)) {
          // Merge new defaults over existing — parent-derived values update
          // previously set defaults while preserving user-edited fields
          // that are not part of the new defaults.
          merged[k] = { ...(merged[k] || {}), ...v };
        }
        return merged;
      });
    };

    load();
  }, [selectedScv, parentSelections, ikApi]);

  // ── Computed values ──────────────────────────────────────────────────
  const blueprintTemplateIds = useMemo(
    () => new Set(blueprint?.templates.map((t) => t.id) || []),
    [blueprint],
  );

  // External templates mark which parent templates are expected inputs.
  const externalTemplates = useMemo(
    () =>
      (blueprint?.configuration?.external_templates || []) as Array<{
        id: string;
        name: string;
      }>,
    [blueprint],
  );

  // Constant blocks from blueprint configuration
  const constantBlocks = useMemo(
    () =>
      (blueprint?.configuration?.constants || []) as Array<{
        id: string;
        name: string;
      }>,
    [blueprint],
  );

  // Constant wires stored separately from template wiring
  const constantWires = useMemo(
    () => (blueprint?.configuration?.constant_wires || []) as WiringRule[],
    [blueprint],
  );

  // State for constant values entered by the user at use-time
  const [constantValues, setConstantValues] = useState<Record<string, string>>(
    {},
  );

  const wiredVariables = useMemo(
    () =>
      blueprint
        ? computeWiredVariables(
          [...blueprint.wiring, ...constantWires],
          [...blueprint.templates, ...externalTemplates],
          constantBlocks,
        )
        : {},
    [blueprint, constantWires, externalTemplates, constantBlocks],
  );

  const missingParents = useMemo(
    () => computeMissingParents(templateDetails, blueprintTemplateIds),
    [templateDetails, blueprintTemplateIds],
  );

  // Whether all required parents have been selected
  const allParentsResolved = useMemo(() => {
    if (Object.keys(templateDetails).length === 0) return false;
    return !Object.entries(missingParents).some(([templateId, parents]) =>
      parents.some(
        (p) => (parentSelections[templateId]?.[p.id] || []).length === 0,
      ),
    );
  }, [templateDetails, missingParents, parentSelections]);

  // ── Load SCVs only after all required parents are selected ───────────
  useEffect(() => {
    if (!blueprint || blueprint.templates.length === 0 || !allParentsResolved)
      return;

    const load = async () => {
      try {
        const templateIds = blueprint.templates.map((t) => t.id);
        const scvResult = await ikApi.getList("source_code_versions", {
          pagination: { page: 1, perPage: 500 },
          sort: { field: "updated_at", order: "DESC" },
          filter: { template_id: templateIds },
        });

        const scvsMap: Record<string, IkEntity[]> = {};
        const scvSelections: Record<string, string> = {};
        for (const tid of templateIds) {
          scvsMap[tid] = [];
        }
        for (const scv of scvResult.data || []) {
          const tid = scv.template_id || scv.template?.id;
          if (tid && scvsMap[tid]) {
            scvsMap[tid].push(scv);
          }
        }
        for (const tid of templateIds) {
          if (scvsMap[tid].length > 0) {
            scvSelections[tid] = scvsMap[tid][0].id;
          }
        }

        setScvsByTemplate(scvsMap);
        setSelectedScv(scvSelections);
      } catch (e: any) {
        notifyError(e);
      }
    };

    load();
  }, [blueprint, ikApi, allParentsResolved]);

  // Input→input links for value propagation
  const inputLinks = useMemo(() => {
    if (!blueprint) return {};
    const links: Record<
      string,
      Record<
        string,
        Array<{ targetTemplateId: string; targetVariable: string }>
      >
    > = {};
    for (const w of blueprint.wiring) {
      if (w.source_output.startsWith("input:")) {
        const inputName = w.source_output.slice(6);
        if (!links[w.source_template_id]) links[w.source_template_id] = {};
        if (!links[w.source_template_id][inputName])
          links[w.source_template_id][inputName] = [];
        links[w.source_template_id][inputName].push({
          targetTemplateId: w.target_template_id,
          targetVariable: w.target_variable,
        });
      }
    }
    return links;
  }, [blueprint]);

  // Unique parent templates that need resource selection (deduped)
  const uniqueParentTemplates = useMemo(() => {
    const map = new Map<string, string>();
    // From external templates configuration
    for (const ext of externalTemplates) {
      map.set(ext.id, ext.name);
    }
    // From computed missing parents
    for (const parents of Object.values(missingParents)) {
      for (const p of parents) {
        if (!map.has(p.id)) map.set(p.id, p.name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [externalTemplates, missingParents]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleVariableChange = useCallback(
    (templateId: string, varName: string, eventOrValue: any) => {
      const value =
        eventOrValue?.target !== undefined
          ? eventOrValue.target.type === "checkbox"
            ? eventOrValue.target.checked
            : eventOrValue.target.value
          : eventOrValue;
      setVariableValues((prev) => {
        const next = {
          ...prev,
          [templateId]: { ...(prev[templateId] || {}), [varName]: value },
        };

        // Propagate through input→input wires
        const targets = inputLinks[templateId]?.[varName];
        if (targets) {
          for (const { targetTemplateId, targetVariable } of targets) {
            next[targetTemplateId] = {
              ...(next[targetTemplateId] || {}),
              [targetVariable]: value,
            };
          }
        }

        return next;
      });
    },
    [inputLinks],
  );

  const handleParentSelection = useCallback(
    (parentTemplateId: string, resourceIds: string[]) => {
      setParentSelections((prev) => {
        const next = { ...prev };

        // Apply to all templates that have this parent missing
        for (const [templateId, parents] of Object.entries(missingParents)) {
          if (parents.some((p) => p.id === parentTemplateId)) {
            next[templateId] = {
              ...(next[templateId] || {}),
              [parentTemplateId]: resourceIds,
            };
          }
        }

        return next;
      });
    },
    [missingParents],
  );

  const handleScvChange = useCallback(
    (templateId: string, scvId: string | null) => {
      setSelectedScv((prev) => {
        if (!scvId) {
          const next = { ...prev };
          delete next[templateId];
          return next;
        }
        return { ...prev, [templateId]: scvId };
      });
      // Reset variable values for this template on SCV change
      setVariableValues((prev) => ({ ...prev, [templateId]: {} }));
    },
    [],
  );

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!blueprint) return;
    setSubmitting(true);
    try {
      // Build variable_overrides: templateId -> { varName: value }
      const variable_overrides: Record<string, Record<string, any>> = {};
      for (const [templateId, vars] of Object.entries(variableValues)) {
        variable_overrides[templateId] = {};
        for (const [varName, value] of Object.entries(vars)) {
          if (value !== null && value !== undefined && value !== "") {
            variable_overrides[templateId][varName] = value;
          }
        }
      }

      // Include constant-wired values from user-entered constant values
      for (const [templateId, wiredVars] of Object.entries(wiredVariables)) {
        for (const [varName, info] of Object.entries(wiredVars)) {
          if (info.isConstantWire && info.constantId) {
            const val = constantValues[info.constantId];
            if (val !== undefined && val !== "") {
              if (!variable_overrides[templateId]) {
                variable_overrides[templateId] = {};
              }
              variable_overrides[templateId][varName] = val;
            }
          }
        }
      }

      // Build parent_overrides: templateId -> [resourceIds]
      const parent_overrides: Record<string, string[]> = {};
      for (const [templateId, parents] of Object.entries(parentSelections)) {
        const allIds = Object.values(parents).flat();
        if (allIds.length > 0) parent_overrides[templateId] = allIds;
      }

      await ikApi.postRaw(`blueprints/${blueprint_id}/create_execution`, {
        variable_overrides,
        integration_ids: integrationIds,
        storage_id: storageId,
        workspace_id: workspaceId,
        secret_ids: secretIds,
        source_code_version_overrides: selectedScv,
        parent_overrides,
      });

      notify("Blueprint resources are being created", "success");
      navigate(`${linkPrefix}blueprints/${blueprint_id}`);
    } catch (e: any) {
      notifyError(e);
    } finally {
      setSubmitting(false);
    }
  }, [
    blueprint,
    blueprint_id,
    variableValues,
    wiredVariables,
    constantValues,
    parentSelections,
    integrationIds,
    storageId,
    workspaceId,
    secretIds,
    selectedScv,
    ikApi,
    navigate,
    linkPrefix,
  ]);

  // ── Render: loading / error ──────────────────────────────────────────
  if (loading) {
    return (
      <PageContainer
        title="Use Blueprint"
        onBack={() => navigate(`${linkPrefix}blueprints`)}
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

  if (error || !blueprint) {
    return (
      <PageContainer
        title="Use Blueprint"
        onBack={() => navigate(`${linkPrefix}blueprints`)}
      >
        <Alert severity="error" sx={{ width: "100%" }}>
          {error || "Blueprint not found"}
        </Alert>
      </PageContainer>
    );
  }

  const hasAllScvs = blueprint.templates.every((t) => selectedScv[t.id]);

  // ── Render: main form ────────────────────────────────────────────────
  return (
    <PageContainer
      title={`Use Blueprint: ${blueprint.name}`}
      onBack={() => navigate(`${linkPrefix}blueprints/${blueprint_id}`)}
      backAriaLabel="Back to blueprint"
      bottomActions={
        <>
          <Button
            variant="outlined"
            onClick={() => navigate(`${linkPrefix}blueprints/${blueprint_id}`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={submitting || !allParentsResolved || !hasAllScvs}
          >
            {submitting ? "Creating…" : "Create Resources"}
          </Button>
        </>
      }
    >
      {!allParentsResolved && uniqueParentTemplates.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some templates require parent resources that are not included in this
          blueprint. Please select existing resources for all required parents
          to continue.
        </Alert>
      )}

      {/* ── General Configuration ──────────────────────────────── */}
      <PropertyCard title="General Configuration">
        <Box>
          <ArrayReferenceInput
            ikApi={ikApi}
            entity_name="integrations"
            filter={{ integration_type: "cloud" }}
            showFields={["integration_provider", "name"]}
            buffer={buffer}
            setBuffer={setBuffer}
            error={false}
            helpertext="Select cloud integrations for the resources"
            value={integrationIds}
            label="Cloud Integrations"
            required
            multiple
            fullWidth
            onChange={(ids: string[]) => setIntegrationIds(ids)}
          />

          <ArrayReferenceInput
            ikApi={ikApi}
            entity_name="secrets"
            showFields={["name", "secret_provider"]}
            buffer={buffer}
            setBuffer={setBuffer}
            error={false}
            helpertext="Select secrets for the resources"
            value={secretIds}
            label="Secrets"
            multiple
            fullWidth
            onChange={(ids: string[]) => setSecretIds(ids)}
          />

          {integrationIds.length > 0 && (
            <ReferenceInput
              ikApi={ikApi}
              entity_name="storages"
              buffer={buffer}
              showFields={["name", "storage_provider"]}
              setBuffer={setBuffer}
              error={false}
              helpertext="Select storage for TF state"
              filter={{ integration_id: integrationIds }}
              value={storageId}
              label="Storage for TF State"
              required
              onChange={(val: string | null) => setStorageId(val)}
            />
          )}

          <ReferenceInput
            ikApi={ikApi}
            entity_name="workspaces"
            buffer={buffer}
            showFields={["name", "workspace_provider"]}
            setBuffer={setBuffer}
            error={false}
            helpertext="Select workspace"
            value={workspaceId}
            label="Workspace"
            onChange={(val: string | null) => setWorkspaceId(val)}
          />

          {/* Parent resource selectors */}
          {uniqueParentTemplates.map((parent) => {
            // Get current selection from any template that has this parent
            const currentValue =
              Object.values(parentSelections).find(
                (sel) => sel[parent.id]?.length > 0,
              )?.[parent.id] || [];

            return (
              <ArrayReferenceInput
                key={parent.id}
                ikApi={ikApi}
                entity_name="resources"
                bufferKey={`parent_global_${parent.id}`}
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
                helpertext={`Select existing "${parent.name}" resources as parent`}
                filter={{ template_id: [parent.id] }}
                value={currentValue}
                label={`Parent: ${parent.name}`}
                required
                multiple
                fullWidth
                onChange={(ids: string[]) =>
                  handleParentSelection(parent.id, ids)
                }
              />
            );
          })}
        </Box>
      </PropertyCard>

      {/* ── Constant Values (only if blueprint has constants) ──── */}
      {constantBlocks.length > 0 && (
        <PropertyCard title="Constants">
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enter values for each constant. These values will be applied to
              all wired template inputs.
            </Typography>
            {constantBlocks.map((c) => (
              <TextField
                key={c.id}
                label={c.name}
                value={constantValues[c.id] || ""}
                onChange={(e) =>
                  setConstantValues((prev) => ({
                    ...prev,
                    [c.id]: e.target.value,
                  }))
                }
                fullWidth
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <Chip
                      icon={<TuneIcon />}
                      label="Constant"
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ mr: 1 }}
                    />
                  ),
                }}
              />
            ))}
          </Box>
        </PropertyCard>
      )}

      {/* ── Per-template sections (only shown when all parents resolved) ── */}
      {allParentsResolved &&
        blueprint.templates.map((t, idx) => {
          const scvs = scvsByTemplate[t.id] || [];
          const currentScv = selectedScv[t.id] || null;
          const vars = variableSchemas[t.id] || [];
          const wired = wiredVariables[t.id] || {};
          const missing = missingParents[t.id] || [];
          const vals = variableValues[t.id] || {};
          const visibleVars = vars.filter(
            (v) =>
              !v.restricted &&
              !v.sensitive &&
              !(
                hideDefaults &&
                !wired[v.name] &&
                v.value !== null &&
                v.value !== undefined &&
                v.value !== ""
              ),
          );
          const totalNonRestricted = vars.filter(
            (v) => !v.restricted && !v.sensitive,
          ).length;
          const hiddenCount = totalNonRestricted - visibleVars.length;

          return (
            <PropertyCard
              key={t.id}
              title={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={idx + 1}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 700, minWidth: 28 }}
                  />
                  <span>{t.name}</span>
                  {Object.keys(wired).length > 0 && (
                    <Chip
                      label={`${Object.keys(wired).length} wired`}
                      size="small"
                      color="info"
                      variant="outlined"
                      icon={<LinkIcon />}
                    />
                  )}
                </Box>
              }
            >
              {/* Source code version selector */}
              <Autocomplete
                options={scvs}
                getOptionLabel={(opt: IkEntity) =>
                  opt.source_code_version || opt.name || opt.id
                }
                value={scvs.find((s) => s.id === currentScv) || null}
                onChange={(_e, newVal) =>
                  handleScvChange(t.id, newVal?.id || null)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Template Version"
                    margin="normal"
                    required
                    helperText={
                      scvs.length === 0
                        ? "No source code versions found for this template"
                        : "Select the template version to use"
                    }
                  />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                fullWidth
                sx={{ mb: 1 }}
              />

              {/* Missing parent selectors */}
              {missing.length > 0 && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  This template requires parent resources (
                  {missing.map((p) => p.name).join(", ")}) — select them in
                  General Configuration above.
                </Alert>
              )}

              {/* Variables */}
              {totalNonRestricted > 0 ? (
                <Accordion
                  defaultExpanded
                  elevation={0}
                  sx={{
                    borderRadius: 1,
                    mt: 2,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        width: "100%",
                      }}
                    >
                      <Typography variant="h5" component="h4">
                        Input Variables ({visibleVars.length}
                        {hiddenCount > 0 && ` of ${totalNonRestricted}`})
                      </Typography>
                      <Tooltip
                        title={
                          hideDefaults
                            ? `Show ${hiddenCount} variables with defaults`
                            : "Hide variables with default values"
                        }
                        arrow
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHideDefaults((prev) => !prev);
                          }}
                          color={hideDefaults ? "primary" : "default"}
                        >
                          {hideDefaults ? (
                            <VisibilityIcon fontSize="small" />
                          ) : (
                            <VisibilityOffIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Table size="small">
                      <TableBody>
                        {visibleVars.map((variable) => {
                          const isWired = !!wired[variable.name];
                          const wiredInfo = wired[variable.name];
                          const isConstantWired =
                            isWired && wiredInfo.isConstantWire;
                          const constantVal =
                            isConstantWired && wiredInfo.constantId
                              ? constantValues[wiredInfo.constantId] || ""
                              : undefined;
                          const hasDefault =
                            !isWired &&
                            variable.value !== null &&
                            variable.value !== undefined &&
                            variable.value !== "";

                          return (
                            <ResourceVariableRow
                              key={variable.name}
                              variable={variable}
                              hasDefault={hasDefault}
                              field={{
                                value: isConstantWired
                                  ? constantVal
                                  : (vals[variable.name] ?? variable.value),
                                name: `${t.id}.${variable.name}`,
                                onChange: isConstantWired
                                  ? () => { } // value set via constant input above
                                  : (value: any) =>
                                    handleVariableChange(
                                      t.id,
                                      variable.name,
                                      value,
                                    ),
                              }}
                              isDisabled={isConstantWired}
                            >
                              {isWired ? (
                                <Tooltip
                                  title={
                                    wiredInfo.isConstantWire
                                      ? `Value set by constant "${wiredInfo.sourceTemplateName}" in General Configuration`
                                      : wiredInfo.isInputWire
                                        ? `This variable is linked to the "${wiredInfo.sourceOutput}" input of "${wiredInfo.sourceTemplateName}" — values will stay in sync`
                                        : `This variable will receive its value from the output of "${wiredInfo.sourceTemplateName}"`
                                  }
                                  arrow
                                >
                                  <Chip
                                    icon={
                                      wiredInfo.isConstantWire ? (
                                        <TuneIcon />
                                      ) : (
                                        <LinkIcon />
                                      )
                                    }
                                    label={
                                      wiredInfo.isConstantWire
                                        ? `Constant: ${wiredInfo.sourceTemplateName}`
                                        : wiredInfo.isInputWire
                                          ? `Linked: ${wiredInfo.sourceTemplateName} → ${wiredInfo.sourceOutput}`
                                          : `Wired: ${wiredInfo.sourceTemplateName} → ${wiredInfo.sourceOutput}`
                                    }
                                    size="small"
                                    color={
                                      wiredInfo.isConstantWire
                                        ? "secondary"
                                        : wiredInfo.isInputWire
                                          ? "warning"
                                          : "info"
                                    }
                                    variant="outlined"
                                    sx={{ mt: 1 }}
                                  />
                                </Tooltip>
                              ) : undefined}
                            </ResourceVariableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              ) : currentScv ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  No input variables for this template version.
                </Typography>
              ) : null}
            </PropertyCard>
          );
        })}
    </PageContainer>
  );
};

BlueprintUsePage.path = "/blueprints/:blueprint_id/use";
