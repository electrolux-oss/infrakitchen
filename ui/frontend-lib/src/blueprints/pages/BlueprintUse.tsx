import { useCallback, useEffect, useMemo, useState } from "react";

import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { VariableCard } from "../../common/components/fields/VariableCard";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import {
  WiringRule,
  WiringTargetType,
} from "../../common/components/viewers/Wiring/types";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { ResourceVariableRow } from "../../resources/components/variables/ResourceVariablesForm";
import { ResourceVariableSchema } from "../../resources/types";
import { GqlTemplateShort } from "../../templates/graphql";
import { IkEntity } from "../../types";
import { GqlWorkflow } from "../../workflows/graphql";
import {
  BLUEPRINT_USE_QUERY,
  BLUEPRINT_USE_SOURCE_CODE_VERSIONS_QUERY,
  BLUEPRINT_USE_VARIABLE_SCHEMA_QUERY,
  CREATE_BLUEPRINT_WORKFLOW_MUTATION,
  GqlBlueprintResourceVariableSchema,
  GqlBlueprintUse,
  BlueprintWorkflowCreateMutationInput,
} from "../graphql";

interface BlueprintUseFormValues {
  integrationIds: string[];
  storageId: string | null;
  workspaceId: string | null;
  secretIds: string[];
  selectedScv: Record<string, string>;
  variableValues: Record<string, Record<string, any>>;
  /** Required dependency config values: templateId -> name -> value */
  configValues: Record<string, Record<string, string>>;
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
  targetType: WiringTargetType = "variable",
): Record<string, Record<string, WiredInfo>> {
  const nameMap = new Map(templates.map((t) => [t.id, t.name]));
  const constantMap = new Map(constants.map((c) => [c.id, c]));
  const result: Record<string, Record<string, WiredInfo>> = {};
  for (const w of wiring) {
    if ((w.target_type ?? "variable") !== targetType) continue;
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

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function requiredConfigsOf(template: {
  configuration?: Record<string, any> | null;
}): string[] {
  // template configuration is a raw JSON field, so its keys are snake_case
  return template.configuration?.required_configuration_variables ?? [];
}

function computeMissingParents(
  templates: Array<{ id: string; parents: GqlTemplateShort[] }>,
  blueprintTemplateIds: Set<string>,
): Record<string, GqlTemplateShort[]> {
  const result: Record<string, GqlTemplateShort[]> = {};
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

  const [blueprint, setBlueprint] = useState<GqlBlueprintUse | null>(null);
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
        configValues: {},
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
  const configValues = useWatch({ control, name: "configValues" });

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
        setBlueprint(result.blueprint);
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
            const response = await ikApi.graphqlRequest<{
              resourceVariableSchema: GqlBlueprintResourceVariableSchema[];
            }>(BLUEPRINT_USE_VARIABLE_SCHEMA_QUERY, {
              sourceCodeVersionId: scvId,
              parentResourceIds: Array.from(parentIds),
            });
            const schema = (response.resourceVariableSchema || []).map(
              (variable) => ({
                ...variable,
                description: variable.description || "",
              }),
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
    () => new Set(blueprint?.templates?.map((t) => t.id) || []),
    [blueprint],
  );

  // External templates mark which parent templates are expected inputs.
  const externalTemplates = useMemo(
    () => blueprint?.externalTemplates || [],
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
            [...(blueprint.templates || []), ...externalTemplates],
            constantBlocks,
          )
        : {},
    [blueprint, constantWires, externalTemplates, constantBlocks],
  );

  const wiredConfigs = useMemo(
    () =>
      blueprint
        ? computeWiredVariables(
            [...blueprint.wiring, ...constantWires],
            [...(blueprint.templates || []), ...externalTemplates],
            constantBlocks,
            "dependency_config",
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
  // Required, user-editable variables left empty, per template; the value is
  // the one the field shows (user input, else the schema default)
  const missingVariables = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    for (const t of blueprint?.templates || []) {
      const wired = wiredVariables[t.id] || {};
      const values = variableValues[t.id] || {};
      result[t.id] = new Set(
        (variableSchemas[t.id] || [])
          .filter(
            (v) =>
              v.required &&
              !v.restricted &&
              !v.sensitive &&
              !wired[v.name] && // value supplied by wiring/constant
              isEmptyValue(values[v.name] ?? v.value),
          )
          .map((v) => v.name),
      );
    }
    return result;
  }, [blueprint, variableSchemas, wiredVariables, variableValues]);

  const allRequiredVariablesFilled = useMemo(
    () =>
      !!blueprint &&
      Object.values(missingVariables).every((names) => names.size === 0),
    [blueprint, missingVariables],
  );

  // Every required dependency config must be wired, set by a constant or entered
  const missingConfigs = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    for (const t of blueprint?.templates || []) {
      result[t.id] = new Set(
        requiredConfigsOf(t).filter(
          (name) =>
            !wiredConfigs[t.id]?.[name] &&
            isEmptyValue(configValues[t.id]?.[name]),
        ),
      );
    }
    return result;
  }, [blueprint, wiredConfigs, configValues]);

  const allRequiredConfigsFilled = useMemo(
    () => Object.values(missingConfigs).every((names) => names.size === 0),
    [missingConfigs],
  );

  const handleConfigChange = useCallback(
    (templateId: string, name: string, value: string) => {
      const prev = getValues("configValues");
      setValue("configValues", {
        ...prev,
        [templateId]: { ...(prev[templateId] || {}), [name]: value },
      });
    },
    [getValues, setValue],
  );

  // Load SCVs only after all required parents are selected
  useEffect(() => {
    if (!blueprint || blueprint.templates?.length === 0 || !allParentsResolved)
      return;

    const load = async () => {
      try {
        const templateIds = blueprint.templates?.map((t) => t.id) || [];
        const scvResult = await ikApi.graphqlRequest<{
          sourceCodeVersions: IkEntity[];
        }>(BLUEPRINT_USE_SOURCE_CODE_VERSIONS_QUERY, {
          filter: { template_id: templateIds },
          sort: ["updated_at", "DESC"],
          range: [0, 500],
        });

        const scvsMap: Record<string, IkEntity[]> = {};
        const scvSelections: Record<string, string> = {};
        for (const tid of templateIds) {
          scvsMap[tid] = [];
        }
        for (const scv of scvResult.sourceCodeVersions || []) {
          const tid = scv.template?.id;
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
    const map = new Map<string, GqlTemplateShort>();
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

  // The backend requires integrations on a child when a parent resource has them
  const parentsHaveIntegrations = useMemo(() => {
    const selectedIds = new Set(
      Object.values(parentSelections).flatMap((sel) =>
        Object.values(sel).flat(),
      ),
    );
    return uniqueParentTemplates.some((parent) => {
      const options = buffer[`parent_global_${parent.id}`];
      return (
        Array.isArray(options) &&
        options.some(
          (r) => selectedIds.has(r.id) && (r.integrationIds?.length ?? 0) > 0,
        )
      );
    });
  }, [parentSelections, uniqueParentTemplates, buffer]);

  // Integrations are optional unless a template allows only specific providers
  // or a selected parent resource has integrations
  const integrationRequired = useMemo(
    () =>
      parentsHaveIntegrations ||
      (blueprint?.templates || []).some(
        (t) =>
          (t.configuration?.allowed_provider_integration_types?.length ?? 0) >
          0,
      ),
    [blueprint, parentsHaveIntegrations],
  );

  // postgresql storages can always be used, cloud storages only with the resource integrations;
  // the backend is accessed with the storage integration
  const filterStorage = useMemo(
    () =>
      integrationIds.length > 0
        ? {
            or: [
              { integration_id: integrationIds },
              { storage_provider: "postgresql" },
            ],
          }
        : { storage_provider: "postgresql" },
    [integrationIds],
  );

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

        // Build dependency_config_overrides: templateId -> { name: value }
        const dependency_config_overrides: Record<
          string,
          Record<string, string>
        > = {};
        for (const [templateId, configs] of Object.entries(data.configValues)) {
          for (const [name, value] of Object.entries(configs)) {
            if (value?.trim()) {
              dependency_config_overrides[templateId] = {
                ...(dependency_config_overrides[templateId] || {}),
                [name]: value,
              };
            }
          }
        }
        for (const [templateId, wiredCfg] of Object.entries(wiredConfigs)) {
          for (const [name, info] of Object.entries(wiredCfg)) {
            const val = info.constantId
              ? data.constantValues[info.constantId]
              : undefined;
            if (info.isConstantWire && val !== undefined && val !== "") {
              dependency_config_overrides[templateId] = {
                ...(dependency_config_overrides[templateId] || {}),
                [name]: String(val),
              };
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

        const response = await ikApi.graphqlRequest<{
          createBlueprintWorkflow: GqlWorkflow;
        }>(CREATE_BLUEPRINT_WORKFLOW_MUTATION, {
          id: blueprint_id,
          input: {
            variableOverrides: variable_overrides,
            dependencyConfigOverrides: dependency_config_overrides,
            integrationIds: data.integrationIds,
            storageId: data.storageId,
            workspaceId: data.workspaceId,
            secretIds: data.secretIds,
            sourceCodeVersionOverrides: data.selectedScv,
            parentOverrides: parent_overrides,
          } satisfies BlueprintWorkflowCreateMutationInput,
        });

        notify("Workflow was created", "success");
        navigate(
          `${linkPrefix}workflows/${response.createBlueprintWorkflow.id}`,
        );
      } catch (e: any) {
        notifyError(e);
      } finally {
        setSubmitting(false);
      }
    },
    [
      blueprint,
      blueprint_id,
      wiredVariables,
      wiredConfigs,
      ikApi,
      navigate,
      linkPrefix,
    ],
  );

  if (loading) {
    return (
      <PageContainer title="Use Blueprint">
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
      <PageContainer title="Use Blueprint">
        <Alert severity="error" sx={{ width: "100%" }}>
          {error || "Blueprint not found"}
        </Alert>
      </PageContainer>
    );
  }

  // Abstract templates have no source code version
  const hasAllScvs = blueprint.templates?.every(
    (t) => t.abstract || selectedScv[t.id],
  );
  const canSubmit =
    !submitting &&
    allParentsResolved &&
    hasAllScvs &&
    !!storageId &&
    (!integrationRequired || integrationIds.length > 0) &&
    allConstantsFilled &&
    allRequiredConfigsFilled &&
    allRequiredVariablesFilled;

  return (
    <PageContainer
      title={`Use Blueprint: ${blueprint.name}`}
      bottomActions={
        <>
          <Button
            onClick={() => navigate(`${linkPrefix}blueprints/${blueprint_id}`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
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
            filter={{
              integration_type: "cloud",
              integration_provider__not_eq: "postgresql",
            }}
            showFields={["integrationProvider", "name"]}
            buffer={buffer}
            setBuffer={setBuffer}
            error={integrationRequired && integrationIds.length === 0}
            helpertext={
              integrationRequired
                ? "Integrations are required by the blueprint templates or selected parent resources"
                : "Select cloud integrations for the resources (optional)"
            }
            value={integrationIds}
            label="Cloud Integrations"
            required={integrationRequired}
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

          <ReferenceInput
            ikApi={ikApi}
            entity_name="storages"
            buffer={buffer}
            showFields={["name", "storageProvider"]}
            fields={["name", "storageProvider", "state"]}
            getOptionDisabled={(option: IkEntity) =>
              option.state !== "PROVISIONED"
            }
            setBuffer={setBuffer}
            error={false}
            helpertext="Select storage for TF state"
            filter={filterStorage}
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
                  "template.id",
                  "template.name",
                  "integration_ids.id",
                  "integration_ids.name",
                  "storage.id",
                  "storage.name",
                  "workspace.id",
                  "workspace.name",
                  "secret_ids.id",
                  "secret_ids.name",
                  "id",
                ]}
                error={false}
                helpertext={`Select existing "${parent.name}" resources as parent`}
                filter={{
                  template_id: [parent.id],
                  ...(!parent.abstract && integrationIds.length > 0
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
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 1,
              }}
            >
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
                  slotProps={{
                    input: {
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
                    },
                  }}
                />
              );
            })}
          </Box>
        </PropertyCard>
      )}
      {allParentsResolved &&
        blueprint.templates?.map((t, idx) => {
          const scvs = scvsByTemplate[t.id] || [];
          const currentScv = selectedScv[t.id] || null;
          const vars = variableSchemas[t.id] || [];
          const wired = wiredVariables[t.id] || {};
          const missing = missingParents[t.id] || [];
          const vals = variableValues[t.id] || {};
          const missingVars = missingVariables[t.id] ?? new Set<string>();
          const visibleVars = vars.filter(
            (v) =>
              !v.restricted &&
              !v.sensitive &&
              // missing required values stay visible even with defaults hidden
              !(
                hideDefaults &&
                !missingVars.has(v.name) &&
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
          const missingCount =
            missingVars.size + (missingConfigs[t.id]?.size ?? 0);

          return (
            <PropertyCard
              key={t.id}
              title={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={idx + 1}
                    color="primary"
                    sx={{ fontWeight: 700, minWidth: 28 }}
                  />
                  <span>{t.name}</span>
                  {Object.keys(wired).length > 0 && (
                    <Chip
                      label={`${Object.keys(wired).length} wired`}
                      color="info"
                      variant="outlined"
                      icon={<LinkIcon />}
                    />
                  )}
                  {missingCount > 0 && (
                    <Chip
                      label={`${missingCount} required missing`}
                      color="error"
                      icon={<ErrorOutlineIcon />}
                    />
                  )}
                </Box>
              }
            >
              {/* Source code version selector, abstract templates have none */}
              {!t.abstract && (
                <Autocomplete
                  options={scvs}
                  getOptionLabel={(opt: IkEntity) =>
                    opt.identifier ||
                    opt.sourceCodeVersion ||
                    opt.sourceCodeBranch ||
                    opt.id
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
              )}
              {/* Required dependency config */}
              {requiredConfigsOf(t).length > 0 && (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Typography variant="h5" component="h4" sx={{ mb: 1 }}>
                    Dependency Config
                  </Typography>
                  {requiredConfigsOf(t).map((name) => {
                    // Rendered like the input variables: wired values show their source
                    const wiredCfg = wiredConfigs[t.id]?.[name];
                    const value = configValues[t.id]?.[name] ?? "";
                    const isMissing = missingConfigs[t.id]?.has(name) ?? false;
                    return (
                      <VariableCard
                        key={name}
                        name={name}
                        required
                        type="string"
                        description="Required configuration, inherited by child resources"
                      >
                        {wiredCfg ? (
                          <Tooltip
                            title={
                              wiredCfg.isConstantWire
                                ? `Value set by constant "${wiredCfg.sourceTemplateName}" in Constants`
                                : `This configuration will receive its value from "${wiredCfg.sourceTemplateName}"`
                            }
                            arrow
                          >
                            <Chip
                              icon={
                                wiredCfg.isConstantWire ? (
                                  <TuneIcon />
                                ) : (
                                  <LinkIcon />
                                )
                              }
                              label={
                                wiredCfg.isConstantWire
                                  ? `Constant: ${wiredCfg.sourceTemplateName}`
                                  : `Wired: ${wiredCfg.sourceTemplateName} -> ${wiredCfg.sourceOutput}`
                              }
                              size="small"
                              color={
                                wiredCfg.isConstantWire ? "secondary" : "info"
                              }
                              variant="outlined"
                              sx={{ mt: 1 }}
                            />
                          </Tooltip>
                        ) : (
                          <TextField
                            value={value}
                            onChange={(e) =>
                              handleConfigChange(t.id, name, e.target.value)
                            }
                            required
                            error={isMissing}
                            helperText={isMissing ? "Required" : undefined}
                            size="small"
                            fullWidth
                          />
                        )}
                      </VariableCard>
                    );
                  })}
                </Box>
              )}
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
                    borderRadius: "var(--template-surface-radius)",
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
                            borderRadius: "var(--template-surface-radius)",
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
                    <Box>
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
                            fieldState={
                              missingVars.has(variable.name)
                                ? { error: { message: "Required" } }
                                : {}
                            }
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
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ) : currentScv ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    mt: 1,
                  }}
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
