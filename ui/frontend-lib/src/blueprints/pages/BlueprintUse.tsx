import { useCallback, useEffect, useMemo, useState } from "react";

import { useForm, useWatch } from "react-hook-form";
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
  Table,
  TableBody,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { ResourceVariableRow } from "../../resources/components/variables/ResourceVariablesForm";
import { ResourceVariableSchema } from "../../resources/types";
import { TemplateShort } from "../../templates/types";
import { IkEntity } from "../../types";
import { WorkflowResponse } from "../../workflows/types";
import { BLUEPRINT_USE_QUERY } from "../graphql/queries";
import {
  BlueprintUseData,
  GqlBlueprintUse,
  transformBlueprintUse,
} from "../graphql/transforms";

interface BlueprintUseFormValues {
  integrationIds: string[];
  storageId: string | null;
  workspaceId: string | null;
  secretIds: string[];
  selectedScv: Record<string, string>;
  variableValues: Record<string, Record<string, any>>;
  parentSelections: Record<string, Record<string, string[]>>;
  constantValues: Record<string, string>;
}

interface WiredInfo {
  sourceTemplateName: string;
  sourceOutput: string;
  /** True when this is a constant->input wire */
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
    result[w.target_template_id][w.target_variable] = {
      sourceTemplateName: isConstantWire
        ? constant.name || "Constant"
        : nameMap.get(w.source_template_id) || "Unknown",
      sourceOutput: isConstantWire ? constant.name || "value" : w.source_output,
      isConstantWire,
      constantId: isConstantWire ? constant.id : undefined,
    };
  }
  return result;
}

function computeMissingParents(
  templates: Array<{ id: string; parents: TemplateShort[] }>,
  blueprintTemplateIds: Set<string>,
): Record<string, TemplateShort[]> {
  const result: Record<string, TemplateShort[]> = {};
  for (const t of templates) {
    const missing = (t.parents || []).filter(
      (p) => !blueprintTemplateIds.has(p.id),
    );
    if (missing.length > 0) result[t.id] = missing;
  }
  return result;
}

export const BlueprintUsePage = () => {
  const { blueprint_id } = useParams();
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [blueprint, setBlueprint] = useState<BlueprintUseData | null>(null);
  const [scvsByTemplate, setScvsByTemplate] = useState<
    Record<string, IkEntity[]>
  >({});
  const [variableSchemas, setVariableSchemas] = useState<
    Record<string, ResourceVariableSchema[]>
  >({});

  const [hideDefaults, setHideDefaults] = useState(true);

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const { control, handleSubmit, setValue, getValues } =
    useForm<BlueprintUseFormValues>({
      defaultValues: {
        integrationIds: [],
        storageId: null,
        workspaceId: null,
        secretIds: [],
        selectedScv: {},
        variableValues: {},
        parentSelections: {},
        constantValues: {},
      },
      mode: "onChange",
    });

  const integrationIds = useWatch({ control, name: "integrationIds" });
  const storageId = useWatch({ control, name: "storageId" });
  const workspaceId = useWatch({ control, name: "workspaceId" });
  const secretIds = useWatch({ control, name: "secretIds" });
  const selectedScv = useWatch({ control, name: "selectedScv" });
  const parentSelections = useWatch({ control, name: "parentSelections" });
  const constantValues = useWatch({ control, name: "constantValues" });
  const variableValues = useWatch({ control, name: "variableValues" });

  useEffect(() => {
    if (!blueprint_id) return;
    setLoading(true);
    setError(null);
    ikApi
      .graphqlRequest<{ blueprint: GqlBlueprintUse | null }>(
        BLUEPRINT_USE_QUERY,
        { id: blueprint_id },
      )
      .then((result) => {
        if (!result.blueprint) {
          setError("Blueprint not found");
          return;
        }
        setBlueprint(transformBlueprintUse(result.blueprint));
      })
      .catch((e: any) => setError(e.message || "Failed to load blueprint"))
      .finally(() => setLoading(false));
  }, [blueprint_id, ikApi]);

  // Load variable schemas when SCVs are selected
  useEffect(() => {
    if (Object.keys(selectedScv).length === 0) return;

    const load = async () => {
      const schemas: Record<string, ResourceVariableSchema[]> = {};
      const defaults: Record<string, Record<string, any>> = {};
      // Collect all parent resource IDs across templates to pass to the schema endpoint for proper default resolution
      // based on SCV references.
      const parentIds = new Set<string>();
      Object.values(parentSelections).forEach((parents) => {
        Object.values(parents).forEach((ids) =>
          ids.forEach((id) => parentIds.add(id)),
        );
      });

      await Promise.all(
        Object.entries(selectedScv).map(async ([templateId, scvId]) => {
          if (!scvId) return;
          try {
            const schema = await ikApi.getVariableSchema(
              scvId,
              Array.from(parentIds),
            );
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
      const prev = getValues("variableValues");
      const merged = { ...prev };
      for (const [k, v] of Object.entries(defaults)) {
        merged[k] = { ...(merged[k] || {}), ...v };
      }
      setValue("variableValues", merged);
    };

    load();
  }, [selectedScv, parentSelections, ikApi, setValue, getValues]);

  const blueprintTemplateIds = useMemo(
    () => new Set(blueprint?.templates.map((t) => t.id) || []),
    [blueprint],
  );

  // External templates mark which parent templates are expected inputs.
  const externalTemplates = useMemo(
    () => blueprint?.external_templates || [],
    [blueprint],
  );

  // Constant blocks from blueprint configuration
  const constantBlocks = useMemo(
    () =>
      (blueprint?.configuration?.constants || []) as Array<{
        id: string;
        name: string;
        type?: "string" | "number";
        defaultValue?: string;
      }>,
    [blueprint],
  );

  // Constant wires stored separately from template wiring
  const constantWires = useMemo(
    () => (blueprint?.configuration?.constant_wires || []) as WiringRule[],
    [blueprint],
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
    () =>
      blueprint
        ? computeMissingParents(blueprint.templates, blueprintTemplateIds)
        : {},
    [blueprint, blueprintTemplateIds],
  );

  // Whether all required parents have been selected
  const allParentsResolved = useMemo(() => {
    if (!blueprint) return false;
    return !Object.entries(missingParents).some(([templateId, parents]) =>
      parents.some(
        (p) => (parentSelections[templateId]?.[p.id] || []).length === 0,
      ),
    );
  }, [blueprint, missingParents, parentSelections]);

  // All constants declared in the blueprint must be filled in by the user.
  const allConstantsFilled = useMemo(
    () =>
      constantBlocks.every((c) => {
        const v = constantValues[c.id];
        return v !== undefined && v !== null && String(v).trim() !== "";
      }),
    [constantBlocks, constantValues],
  );

  // Every required, user-editable, non-wired variable must have a value
  // (either a schema default or a user-provided override).
  const allRequiredVariablesFilled = useMemo(() => {
    if (!blueprint) return false;
    const isEmpty = (v: unknown) =>
      v === undefined ||
      v === null ||
      (typeof v === "string" && v.trim() === "");

    return blueprint.templates.every((t) => {
      const schemas = variableSchemas[t.id] || [];
      const wired = wiredVariables[t.id] || {};
      const values = variableValues[t.id] || {};
      return schemas.every((v) => {
        if (!v.required || v.restricted || v.sensitive) return true;
        if (wired[v.name]) return true; // value supplied by wiring/constant
        if (!isEmpty(values[v.name])) return true;
        return !isEmpty(v.value); // schema default
      });
    });
  }, [blueprint, variableSchemas, wiredVariables, variableValues]);

  // Load SCVs only after all required parents are selected
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
            const defaultScv = scvsMap[tid].find(
              (s) => s.status !== "disabled",
            )?.id;
            if (defaultScv) {
              scvSelections[tid] = defaultScv;
            }
          }
        }

        setScvsByTemplate(scvsMap);
        setValue("selectedScv", scvSelections);
      } catch (e: any) {
        notifyError(e);
      }
    };

    load();
  }, [blueprint, ikApi, allParentsResolved, setValue]);

  // Unique parent templates that need resource selection (deduped)
  const uniqueParentTemplates = useMemo(() => {
    const map = new Map<string, TemplateShort>();
    // From external templates configuration
    for (const ext of externalTemplates) {
      map.set(ext.id, ext);
    }
    // From computed missing parents
    for (const parents of Object.values(missingParents)) {
      for (const p of parents) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [externalTemplates, missingParents]);

  const handleVariableChange = useCallback(
    (templateId: string, varName: string, eventOrValue: any) => {
      const value =
        eventOrValue?.target !== undefined
          ? eventOrValue.target.type === "checkbox"
            ? eventOrValue.target.checked
            : eventOrValue.target.value
          : eventOrValue;
      const prev = getValues("variableValues");
      const next = {
        ...prev,
        [templateId]: { ...(prev[templateId] || {}), [varName]: value },
      };

      setValue("variableValues", next);
    },
    [getValues, setValue],
  );

  const handleParentSelection = useCallback(
    (parentTemplateId: string, resourceIds: string[]) => {
      const prev = getValues("parentSelections");
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

      setValue("parentSelections", next);
    },
    [missingParents, getValues, setValue],
  );

  const handleScvChange = useCallback(
    (templateId: string, scvId: string | null) => {
      const prev = getValues("selectedScv");
      if (!scvId) {
        const next = { ...prev };
        delete next[templateId];
        setValue("selectedScv", next);
      } else {
        setValue("selectedScv", { ...prev, [templateId]: scvId });
      }
      // Reset variable values for this template on SCV change
      const prevVars = getValues("variableValues");
      setValue("variableValues", { ...prevVars, [templateId]: {} });
    },
    [getValues, setValue],
  );

  const onSubmit = useCallback(
    async (data: BlueprintUseFormValues) => {
      if (!blueprint) return;
      setSubmitting(true);
      try {
        // Build variable_overrides: templateId -> { varName: value }
        const variable_overrides: Record<string, Record<string, any>> = {};
        for (const [templateId, vars] of Object.entries(data.variableValues)) {
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
              const val = data.constantValues[info.constantId];
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
        for (const [templateId, parents] of Object.entries(
          data.parentSelections,
        )) {
          const allIds = Object.values(parents).flat();
          if (allIds.length > 0) parent_overrides[templateId] = allIds;
        }

        await ikApi
          .postRaw(`blueprints/${blueprint_id}/create_workflow`, {
            variable_overrides,
            integration_ids: data.integrationIds,
            storage_id: data.storageId,
            workspace_id: data.workspaceId,
            secret_ids: data.secretIds,
            source_code_version_overrides: data.selectedScv,
            parent_overrides,
          })
          .then((response: WorkflowResponse) => {
            notify("Workflow was created", "success");
            navigate(`${linkPrefix}workflows/${response.id}`);
          });
      } catch (e: any) {
        notifyError(e);
      } finally {
        setSubmitting(false);
      }
    },
    [blueprint, blueprint_id, wiredVariables, ikApi, navigate, linkPrefix],
  );

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
  const canSubmit =
    !submitting &&
    allParentsResolved &&
    hasAllScvs &&
    allConstantsFilled &&
    allRequiredVariablesFilled;

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
            onClick={handleSubmit(onSubmit)}
            disabled={!canSubmit}
          >
            {submitting ? "Creating…" : "Create"}
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

      {allParentsResolved && hasAllScvs && !allRequiredVariablesFilled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some required input variables are empty. Fill them in to create
          resources.
        </Alert>
      )}

      <PropertyCard title="General Configuration">
        <Box>
          <ArrayReferenceInput
            ikApi={ikApi}
            entity_name="integrations"
            filter={{ integration_type: "cloud" }}
            showFields={["integrationProvider", "name"]}
            buffer={buffer}
            setBuffer={setBuffer}
            error={false}
            helpertext="Select cloud integrations for the resources"
            value={integrationIds}
            label="Cloud Integrations"
            required
            multiple
            fullWidth
            onChange={(ids: string[]) => setValue("integrationIds", ids)}
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
            onChange={(ids: string[]) => setValue("secretIds", ids)}
          />

          {integrationIds.length > 0 && (
            <>
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
                onChange={(val: string | null) => setValue("storageId", val)}
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
                    filter={{
                      template_id: [parent.id],
                      ...(!parent.abstract
                        ? { integration_ids__any: integrationIds }
                        : {}),
                    }}
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
            </>
          )}
          <ReferenceInput
            ikApi={ikApi}
            entity_name="workspaces"
            buffer={buffer}
            showFields={["name", "workspace_provider"]}
            setBuffer={setBuffer}
            error={false}
            helpertext="Select workspace for the resources (optional)"
            value={workspaceId}
            label="Workspace"
            onChange={(val: string | null) => setValue("workspaceId", val)}
          />
        </Box>
      </PropertyCard>

      {constantBlocks.length > 0 && (
        <PropertyCard title="Constants">
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enter values for each constant. These values will be applied to
              all wired template inputs.
            </Typography>
            {constantBlocks.map((c) => {
              const raw = constantValues[c.id] ?? c.defaultValue ?? "";
              const isEmpty = String(raw).trim() === "";
              const isNumber = c.type === "number";
              return (
                <TextField
                  key={c.id}
                  label={c.name}
                  value={raw}
                  type={isNumber ? "number" : "text"}
                  onChange={(e) =>
                    setValue("constantValues", {
                      ...getValues("constantValues"),
                      [c.id]: e.target.value,
                    })
                  }
                  required
                  error={isEmpty}
                  helperText={isEmpty ? "This constant is required" : " "}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    startAdornment: (
                      <Chip
                        icon={<TuneIcon />}
                        label={isNumber ? "Number" : "String"}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                    ),
                  }}
                />
              );
            })}
          </Box>
        </PropertyCard>
      )}

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
          const isOptionDisabled = (option: IkEntity) =>
            option.status === "disabled";

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
                disableClearable={false}
                getOptionDisabled={isOptionDisabled}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                fullWidth
                sx={{ mb: 1 }}
              />

              {/* Missing parent selectors */}
              {missing.length > 0 && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  This template requires parent resources (
                  {missing.map((p) => p.name).join(", ")}) - select them in
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
                        <Box
                          component="span"
                          aria-label={
                            hideDefaults
                              ? `Show ${hiddenCount} variables with defaults`
                              : "Hide variables with default values"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setHideDefaults((prev) => !prev);
                          }}
                          onFocus={(e) => e.stopPropagation()}
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            p: 0.5,
                            ml: "auto",
                            borderRadius: 1,
                            color: hideDefaults
                              ? "primary.main"
                              : "action.active",
                            cursor: "pointer",
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          {hideDefaults ? (
                            <VisibilityIcon fontSize="small" />
                          ) : (
                            <VisibilityOffIcon fontSize="small" />
                          )}
                        </Box>
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
                                  ? () => {} // value set via constant input above
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
                                        : `Wired: ${wiredInfo.sourceTemplateName} -> ${wiredInfo.sourceOutput}`
                                    }
                                    size="small"
                                    color={
                                      wiredInfo.isConstantWire
                                        ? "secondary"
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
