import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type RefObject,
} from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
  useFieldArray,
} from "react-hook-form";
import { useLocation, useNavigate } from "react-router";

import { GradientCircularProgress, LabelInput } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { DependencyConfigurationFields } from "../../common/components/hcl/DependencyConfigurationFields";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { MarkdownViewer } from "../../common/components/viewers/MarkdownViewer";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { HeroLockClosedIcon, HeroLockOpenIcon } from "../../icons";
import { GqlTemplateShort } from "../../templates/graphql";
import { ToolSelect } from "../../tools";
import { IkEntity } from "../../types";
import { ValidationRule } from "../../types";
import {
  Alert,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Card,
  CardContent,
} from "../../ui";
import { ENTITY_STATUS } from "../../utils";
import { VERSION_LIFECYCLE_STATE } from "../../utils/constants";
import {
  GqlValidationRulesByVariable,
  transformValidationRulesByVariable,
  VALIDATION_RULES_BY_TEMPLATE_QUERY,
} from "../../validation_rules/graphql";
import { WorkerTemplateSelect } from "../../worker_templates/components/WorkerTemplateSelect";
import { useCanSelectWorkerTemplate } from "../../worker_templates/hooks/useCanSelectWorkerTemplate";
import { ResourceVariableForm } from "../components/variables/ResourceVariablesForm";
import { GqlResource, RESOURCE_VARIABLE_SCHEMA_QUERY } from "../graphql";
import { CREATE_RESOURCE_MUTATION } from "../graphql/mutations";
import { ResourceCreate, ResourceVariableSchema } from "../types";
import {
  getFirstErrorFieldPath,
  validateTagEntries,
} from "../utils/formValidation";
import { buildValidationRuleMaps } from "../utils/validationRules";

const CLONE_NAME_SUFFIX = "-copy";

const toCloneDefaults = (source: GqlResource): Partial<ResourceCreate> => ({
  name: `${source.name}${CLONE_NAME_SUFFIX}`,
  description: source.description ?? "",
  templateId: source.template?.id,
  parents: (source.parents ?? []).map((parent) => String(parent.id)),
  integrationIds: (source.integrationIds ?? []).map((i) => String(i.id)),
  secretIds: (source.secretIds ?? []).map((s) => String(s.id)),
  sourceCodeVersionId: source.sourceCodeVersion?.id ?? "",
  variables: [],
  workspaceId: source.workspace?.id ?? "",
  projectId: source.project?.id ?? "",
  dependencyTags: source.dependencyTags ?? [],
  dependencyConfig: source.dependencyConfig ?? [],
  labels: source.labels ?? [],
  storageId: source.storage?.id ?? "",
  storagePath: "",
  toolId: source.tool?.id ?? "",
  workerTemplateId: source.workerTemplate?.id ?? "",
});

const ResourceCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const canSelectWorkerTemplate = useCanSelectWorkerTemplate();
  const {
    control,
    formState: { errors },
    watch,
    setValue,
    getValues,
    handleSubmit,
  } = useFormContext<ResourceCreate>();

  const { fields } = useFieldArray({
    control,
    name: "variables",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const [schema, setSchema] = useState<ResourceVariableSchema[]>();
  const [validationRuleSummaryByVariable, setValidationRuleSummaryByVariable] =
    useState<Record<string, string>>({});
  const [validationRuleByVariable, setValidationRuleByVariable] = useState<
    Record<string, ValidationRule | null>
  >({});
  const navigate = useNavigate();
  const location = useLocation();
  const cloneSource = location.state?.clone as GqlResource | undefined;

  const [parentSelections, setParentSelections] = useState<
    Record<string, string[]>
  >(() => {
    const selections: Record<string, string[]> = {};
    for (const parent of cloneSource?.parents ?? []) {
      const templateId = String(parent.template?.id);
      selections[templateId] = [
        ...(selections[templateId] ?? []),
        String(parent.id),
      ];
    }
    return selections;
  });
  // Template-dependent resets must not wipe the values copied from the clone
  // source, so they only run once the template differs from the one last seen.
  const sourceCodeVersionTemplateRef = useRef(cloneSource?.template?.id);
  const parentsTemplateRef = useRef(cloneSource?.template?.id);

  const [namingConvention, setNamingConvention] = useState(null);
  const [namingConventionEditable, setNamingConventionEditable] =
    useState(true);

  const resourceDefinitionSectionRef = useRef<HTMLDivElement>(null);
  const dependencyTagsSectionRef = useRef<HTMLDivElement>(null);
  const dependencyConfigSectionRef = useRef<HTMLDivElement>(null);
  const templateConfigSectionRef = useRef<HTMLDivElement>(null);
  const inputVariablesSectionRef = useRef<HTMLDivElement>(null);

  const scrollToErrorSection = useCallback(
    (submitErrors: Record<string, any>) => {
      const firstErrorPath = getFirstErrorFieldPath(submitErrors);
      if (!firstErrorPath) {
        return;
      }

      const rootField = firstErrorPath.split(".")[0];
      const scrollTo = (ref: RefObject<HTMLDivElement | null>) => {
        ref.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      };
      const sectionByField: Record<string, RefObject<HTMLDivElement | null>> = {
        templateId: resourceDefinitionSectionRef,
        name: resourceDefinitionSectionRef,
        description: resourceDefinitionSectionRef,
        dependencyTags: dependencyTagsSectionRef,
        dependencyConfig: dependencyConfigSectionRef,
      };

      if (rootField === "variables") {
        scrollTo(inputVariablesSectionRef);
        return;
      }

      const targetSectionRef = sectionByField[rootField];
      if (targetSectionRef) {
        scrollTo(targetSectionRef);
        return;
      }

      scrollTo(templateConfigSectionRef);
    },
    [],
  );

  useEffect(() => {
    const templateId = location.state?.template_id as string | undefined;
    if (templateId) {
      setValue("templateId", templateId);
    }
  }, [location.state, setValue]);

  const handleBack = () => navigate(`${linkPrefix}resources`);

  const handleSave = useCallback(
    async (data: ResourceCreate) => {
      setSaving(true);
      const payload: ResourceCreate = {
        ...data,
        storageId: data.storageId || null,
        toolId: data.toolId || null,
        // a cloned selection is only kept by users who may select one
        workerTemplateId:
          (canSelectWorkerTemplate && data.workerTemplateId) || null,
        workspaceId: data.workspaceId || null,
        projectId: data.projectId || null,
        sourceCodeVersionId: data.sourceCodeVersionId || null,
      };
      ikApi
        .graphqlRequest<{ createResource: { id: string } }>(
          CREATE_RESOURCE_MUTATION,
          { input: payload },
        )
        .then((response) => {
          const created = response.createResource;
          if (created.id) {
            notify("Resource created successfully", "success");
            navigate(`${linkPrefix}resources/${created.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [ikApi, navigate, setSaving, linkPrefix, canSelectWorkerTemplate],
  );

  const handleInvalidSave = useCallback(
    (submitErrors: Record<string, any>) => {
      scrollToErrorSection(submitErrors);
      notifyError(new Error("Please fix the errors in the form"));
    },
    [scrollToErrorSection],
  );

  const watchedIntegrationIds = watch("integrationIds");
  const watchedTemplateId = watch("templateId");
  const watchedTemplate =
    buffer["templates"]?.find(
      (e: GqlTemplateShort) => e.id === watchedTemplateId,
    ) || null;
  const watchedStorage = watch("storageId");
  const watchedParentIds = watch("parents");
  const watchedProjectId = watch("projectId");
  const watchedSourceCodeVersionId = watch("sourceCodeVersionId");
  const hasDocs = Boolean(watchedTemplate?.documentation);
  const sourceCodeVersionOptions = useMemo(
    () =>
      Array.isArray(buffer["source_code_versions"])
        ? (buffer["source_code_versions"] as Array<{
            id: string;
            lifecycleState?: string | null;
          }>)
        : [],
    [buffer],
  );
  const selectedSourceCodeVersion = useMemo(
    () =>
      watchedSourceCodeVersionId && sourceCodeVersionOptions.length > 0
        ? sourceCodeVersionOptions.find(
            (version) => version.id === watchedSourceCodeVersionId,
          )
        : null,
    [sourceCodeVersionOptions, watchedSourceCodeVersionId],
  );
  const isDeprecatedSourceCodeVersion =
    selectedSourceCodeVersion?.lifecycleState?.toLowerCase() ===
    VERSION_LIFECYCLE_STATE.DEPRECATED;
  const selectedProject = useMemo(
    () =>
      watchedProjectId && Array.isArray(buffer["projects"])
        ? (buffer["projects"] as any[]).find(
            (project) => project.id === watchedProjectId,
          )
        : null,
    [buffer, watchedProjectId],
  );

  // postgresql storages can always be used, cloud storages only with the resource integrations;
  // the backend is accessed with the storage integration
  const filter_storage = useMemo(
    () =>
      watchedIntegrationIds?.length > 0
        ? {
            or: [
              { integration_id: watchedIntegrationIds },
              { storage_provider: "postgresql" },
            ],
          }
        : { storage_provider: "postgresql" },
    [watchedIntegrationIds],
  );

  // template configuration is a raw JSON field, so its keys are snake_case
  const allowedIntegrationTypes: string[] =
    watchedTemplate?.configuration?.allowed_provider_integration_types ?? [];
  const integrationRequired = allowedIntegrationTypes.length > 0;

  const filter_template = useMemo(
    () => ({
      template_id: watchedTemplateId,
    }),
    [watchedTemplateId],
  );

  const watchedName = watch("name");

  useEffect(() => {
    const templateNamingConvention =
      watchedTemplate?.configuration?.naming_convention;
    if (templateNamingConvention) {
      setNamingConvention(templateNamingConvention);
      if (!cloneSource) {
        setValue("name", templateNamingConvention, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setNamingConventionEditable(false);
      }
    }
  }, [watchedTemplate, setValue, cloneSource]);

  useEffect(() => {
    if (sourceCodeVersionTemplateRef.current === watchedTemplateId) return;
    sourceCodeVersionTemplateRef.current = watchedTemplateId;
    setValue("sourceCodeVersionId", null);
  }, [watchedTemplateId, setValue]);

  useEffect(() => {
    if (!watchedTemplateId || watchedSourceCodeVersionId) return;

    const activeVersion = sourceCodeVersionOptions.find(
      (version) =>
        version.lifecycleState?.toLowerCase() ===
        VERSION_LIFECYCLE_STATE.ACTIVE,
    );

    if (activeVersion) {
      setValue("sourceCodeVersionId", activeVersion.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    watchedTemplateId,
    watchedSourceCodeVersionId,
    sourceCodeVersionOptions,
    setValue,
  ]);

  useEffect(() => {
    const requiredVars =
      watchedTemplate?.configuration?.required_configuration_variables || [];
    if (requiredVars.length === 0) return;
    const currentConfig = (watch("dependencyConfig") || []) as Array<{
      name: string;
      value: string;
      inherited_by_children: boolean;
    }>;
    const existingNames = new Set(currentConfig.map((entry) => entry.name));
    const newEntries = requiredVars
      .filter((name: string) => !existingNames.has(name))
      .map((name: string) => ({
        name,
        value: "",
        inherited_by_children: true,
      }));
    if (newEntries.length > 0) {
      setValue("dependencyConfig", [...currentConfig, ...newEntries]);
    }
  }, [watchedTemplate, setValue, watch]);

  useEffect(() => {
    if (parentsTemplateRef.current === watchedTemplateId) return;
    parentsTemplateRef.current = watchedTemplateId;
    setParentSelections({});
    setValue("parents", [], { shouldValidate: true });
  }, [watchedTemplateId, setValue]);

  useEffect(() => {
    if (watchedTemplate) {
      setValue(
        "storagePath",
        `service-catalog/${watchedTemplate.template}/${watchedName}/terraform.tfstate`.replaceAll(
          " ",
          "_",
        ),
      );
    }
  }, [watchedName, watchedTemplate, setValue]);

  const parentCandidates = useMemo(
    () =>
      watchedTemplate?.parents
        ? watchedTemplate.parents.flatMap(
            (parent: IkEntity) =>
              (buffer[String(parent.id)] as IkEntity[]) || [],
          )
        : [],
    [watchedTemplate, buffer],
  );

  const resolvedLastParent = useMemo(() => {
    if (watchedParentIds.length === 0) return null;
    const primaryParentId = watchedParentIds.at(-1);
    return (
      parentCandidates.find(
        (e: GqlResource) => String(e.id) === String(primaryParentId),
      ) || null
    );
  }, [watchedParentIds, parentCandidates]);

  // Integrations, workspaces and secrets of every selected parent can be picked
  // without write access (the backend exempts them), so they stay visible in the pickers.
  const { parentIntegrationIds, parentWorkspaceIds, parentSecretIds } =
    useMemo(() => {
      const selected = new Set(watchedParentIds.map(String));
      const integrationIds = new Set<string>();
      const workspaceIds = new Set<string>();
      const secretIds = new Set<string>();
      for (const parent of parentCandidates as Array<
        IkEntity & {
          integrationIds?: Array<{ id: string }>;
          workspace?: { id: string } | null;
          secretIds?: Array<{ id: string }>;
        }
      >) {
        if (!selected.has(String(parent.id))) continue;
        for (const integration of parent.integrationIds ?? []) {
          integrationIds.add(String(integration.id));
        }
        if (parent.workspace?.id) {
          workspaceIds.add(String(parent.workspace.id));
        }
        for (const secret of parent.secretIds ?? []) {
          secretIds.add(String(secret.id));
        }
      }
      return {
        parentIntegrationIds: [...integrationIds],
        parentWorkspaceIds: [...workspaceIds],
        parentSecretIds: [...secretIds],
      };
    }, [watchedParentIds, parentCandidates]);

  const inherited = useMemo(() => {
    const parent = resolvedLastParent as
      | (IkEntity & {
          integrationIds?: Array<{ id: string }>;
          storage?: { id: string } | null;
          workspace?: { id: string } | null;
          project?: {
            id: string;
            name?: string;
            workspace?: { id: string; name?: string } | null;
          } | null;
          projectId?: string | null;
        })
      | null;
    const integrationIds =
      parent?.integrationIds?.map((i: { id: string }) => i.id) || [];
    const project =
      parent?.project?.id || parent?.projectId
        ? {
            id: parent?.project?.id || parent?.projectId || "",
            name: parent?.project?.name,
            workspace: parent?.project?.workspace || null,
          }
        : null;
    return {
      integration: integrationIds.length > 0,
      storage: Boolean(parent?.storage?.id),
      workspace: Boolean(parent?.workspace?.id),
      project: project,
      integrationIds,
      storageId: parent?.storage?.id || null,
      workspaceId: parent?.workspace?.id || null,
      projectId: project?.id || null,
    };
  }, [resolvedLastParent]);

  const lastAppliedParentIdRef = useRef<string | null>(null);
  const lastAppliedProjectWorkspaceIdRef = useRef<string | null>(null);
  const lastHandledProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resolvedLastParent) {
      lastAppliedParentIdRef.current = null;
      return;
    }
    const parentId = String((resolvedLastParent as IkEntity).id);
    if (lastAppliedParentIdRef.current === parentId) return;
    lastAppliedParentIdRef.current = parentId;
    if (inherited.integration) {
      setValue("integrationIds", inherited.integrationIds);
    }
    if (inherited.storage) {
      setValue("storageId", inherited.storageId);
    }
    if (inherited.workspace) {
      setValue("workspaceId", inherited.workspaceId);
    }
    if (inherited.projectId) {
      setValue("projectId", inherited.projectId);
      setBuffer((prev: Record<string, IkEntity | IkEntity[]>) => {
        const currentProjects = Array.isArray(prev.projects)
          ? prev.projects
          : [];
        if (
          currentProjects.some((project) => project.id === inherited.projectId)
        ) {
          return prev;
        }
        return {
          ...prev,
          projects: [
            ...currentProjects,
            inherited.project as unknown as IkEntity,
          ],
        };
      });
    }
  }, [resolvedLastParent, inherited, setValue]);

  // undefined until the workspace picker has loaded its options
  const availableWorkspaces = buffer.workspaces as IkEntity[] | undefined;

  // Prefill the workspace from the project only when the project changes,
  // so the user can still clear or replace it afterwards.
  useEffect(() => {
    const projectId = selectedProject?.id ?? null;
    if (projectId === lastHandledProjectIdRef.current) return;
    if (!availableWorkspaces) return;
    lastHandledProjectIdRef.current = projectId;

    const projectWorkspaceId =
      selectedProject?.workspace?.id || selectedProject?.workspaceId || null;
    // The picker only lists workspaces the user can write to (or inherited from
    // a parent); prefilling one outside that list would be submitted but
    // render as an empty field.
    const projectWorkspaceAvailable = availableWorkspaces.some(
      (workspace) => String(workspace.id) === String(projectWorkspaceId),
    );

    if (
      inherited.workspace ||
      !projectWorkspaceId ||
      !projectWorkspaceAvailable
    ) {
      lastAppliedProjectWorkspaceIdRef.current = null;
      return;
    }

    const currentWorkspaceId = getValues("workspaceId");
    if (
      !currentWorkspaceId ||
      currentWorkspaceId === lastAppliedProjectWorkspaceIdRef.current
    ) {
      setValue("workspaceId", projectWorkspaceId);
      lastAppliedProjectWorkspaceIdRef.current = projectWorkspaceId;
    }
  }, [
    inherited.workspace,
    selectedProject,
    availableWorkspaces,
    setValue,
    getValues,
  ]);

  useEffect(() => {
    if (watchedSourceCodeVersionId) {
      setIsLoading(true);
      ikApi
        .graphqlRequest<{ resourceVariableSchema: ResourceVariableSchema[] }>(
          RESOURCE_VARIABLE_SCHEMA_QUERY,
          {
            sourceCodeVersionId: watchedSourceCodeVersionId,
            parentResourceIds: watchedParentIds ? watchedParentIds : [],
            projectId: watchedProjectId || null,
          },
        )
        .then(({ resourceVariableSchema }) => {
          const response = resourceVariableSchema.map((variable) => ({
            ...variable,
            description: variable.description || "",
          }));
          setSchema(
            response.sort((a, b) => {
              // Sort required items first
              if (a.required !== b.required) {
                return b.required ? 1 : -1;
              }

              // Then sort by index
              return a.index - b.index;
            }),
          );
          let variables = response;
          if (
            cloneSource &&
            watchedSourceCodeVersionId === cloneSource.sourceCodeVersion?.id
          ) {
            // sensitive values are never returned, restricted and unique ones
            // must not be carried over
            const sourceValues = new Map(
              (cloneSource.variables ?? []).map((v: any) => [v.name, v.value]),
            );
            variables = response.map((variable) =>
              sourceValues.has(variable.name) &&
              !variable.sensitive &&
              !variable.restricted &&
              !variable.unique
                ? { ...variable, value: sourceValues.get(variable.name) }
                : variable,
            );
          }
          setValue("variables", variables);
        })
        .catch((error: any) => {
          notifyError(error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setSchema(undefined);
      setValue("variables", []);
    }
  }, [
    ikApi,
    watchedSourceCodeVersionId,
    watchedParentIds,
    watchedProjectId,
    setSchema,
    setValue,
    cloneSource,
  ]);

  useEffect(() => {
    if (!watchedTemplateId) {
      setValidationRuleSummaryByVariable({});
      setValidationRuleByVariable({});
      return;
    }

    ikApi
      .graphqlRequest<{
        validationRulesByTemplate: GqlValidationRulesByVariable[];
      }>(VALIDATION_RULES_BY_TEMPLATE_QUERY, {
        templateId: watchedTemplateId,
      })
      .then(({ validationRulesByTemplate }) => {
        const response = validationRulesByTemplate.map(
          transformValidationRulesByVariable,
        );
        const { summaryByVariable, ruleByVariable } =
          buildValidationRuleMaps(response);

        setValidationRuleSummaryByVariable(summaryByVariable);
        setValidationRuleByVariable(ruleByVariable);
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [ikApi, watchedTemplateId]);

  return (
    <PageContainer
      title={
        cloneSource ? `Clone Resource ${cloneSource.name}` : "Create Resource"
      }
      bottomActions={
        <>
          <Button onClick={handleBack}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit(handleSave, handleInvalidSave)}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex w-full min-w-80 flex-col items-start gap-4">
        <div className="flex w-full min-w-0 grow flex-col items-center">
          <div className="w-full" ref={resourceDefinitionSectionRef}>
            <PropertyCard title="Resource Definition">
              <div>
                <Controller
                  name="templateId"
                  control={control}
                  rules={{ required: "*Required" }}
                  render={({ field }) => (
                    <ReferenceInput
                      {...field}
                      ikApi={ikApi}
                      entity_name="templates"
                      fields={[
                        "name",
                        "template",
                        "configuration",
                        "abstract",
                        "parents.id",
                        "parents.name",
                      ]}
                      buffer={buffer}
                      setBuffer={setBuffer}
                      error={!!errors.templateId}
                      value={field.value}
                      label="Template"
                      required
                      fullWidth
                    />
                  )}
                />
                {hasDocs && (
                  <Card className="mt-4">
                    <CardContent>
                      <MarkdownViewer
                        content={watchedTemplate?.documentation || ""}
                      />
                    </CardContent>
                  </Card>
                )}
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: "Name is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Name"
                      required
                      disabled={!namingConventionEditable}
                      placeholder="Enter resource name. It should be unique within the selected template."
                      error={!!errors.name}
                      fullWidth
                      margin="normal"
                      helperText={
                        errors.name
                          ? errors.name.message
                          : namingConvention
                            ? `Naming convention enforced by template: ${namingConvention}. You can unlock the name field to provide a custom name or pattern, but make sure it is unique within the selected template.`
                            : "Enter resource name. It should be unique within the selected template."
                      }
                      endAdornment={
                        <InputAdornment position="end">
                          {namingConvention && (
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() =>
                                setNamingConventionEditable(
                                  (editable) => !editable,
                                )
                              }
                            >
                              {namingConventionEditable ? (
                                <HeroLockOpenIcon fontSize="small" />
                              ) : (
                                <HeroLockClosedIcon fontSize="small" />
                              )}
                            </IconButton>
                          )}
                        </InputAdornment>
                      }
                    />
                  )}
                />
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description"
                      placeholder="Enter resource description (optional)"
                      error={!!errors.description}
                      fullWidth
                      margin="normal"
                    />
                  )}
                />
              </div>
            </PropertyCard>
          </div>

          <div className="w-full">
            <DependencyConfigurationFields
              control={control}
              errors={errors}
              dependencyTagsName="dependencyTags"
              dependencyConfigName="dependencyConfig"
              dependencyTagsRules={{
                validate: {
                  requiredFields: (value) => validateTagEntries(value),
                },
              }}
              dependencyConfigRules={{
                validate: {
                  requiredFields: (value) => validateTagEntries(value),
                  requiredConfigVars: (value) => {
                    const required =
                      watchedTemplate?.configuration
                        ?.required_configuration_variables;
                    if (!required || required.length === 0) return true;
                    const dependencyConfigValue = Array.isArray(value)
                      ? (value as Array<{ name: string }>)
                      : [];
                    const inheritedProjectConfig = Array.isArray(
                      selectedProject?.dependencyConfig,
                    )
                      ? selectedProject.dependencyConfig
                          .filter(
                            (entry: {
                              inherited_by_children?: boolean;
                              value?: unknown;
                            }) =>
                              entry.inherited_by_children &&
                              entry.value !== null &&
                              entry.value !== undefined,
                          )
                          .map((entry: { name: string }) => entry.name)
                      : [];
                    const provided = new Set([
                      ...dependencyConfigValue.map((v) => v.name),
                      ...inheritedProjectConfig,
                    ]);
                    const missing = required.filter(
                      (name: string) => !provided.has(name),
                    );
                    if (missing.length > 0) {
                      return `Missing required config variable(s): ${missing.join(", ")}`;
                    }
                    return true;
                  },
                },
              }}
              dependencyTagsSectionRef={dependencyTagsSectionRef}
              dependencyConfigSectionRef={dependencyConfigSectionRef}
            />
          </div>
          {watchedTemplate?.abstract === true && (
            <div className="w-full" ref={templateConfigSectionRef}>
              <PropertyCard title="Template Configuration">
                <div>
                  {watchedTemplate && watchedTemplate.parents?.length > 0 && (
                    <>
                      <Controller
                        name="parents"
                        control={control}
                        rules={{ required: "*Required" }}
                        render={({ field }) => (
                          <>
                            {watchedTemplate.parents.map((parent: IkEntity) => (
                              <ArrayReferenceInput
                                key={parent.id}
                                ikApi={ikApi}
                                buffer={buffer}
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
                                  "project.id",
                                  "project.name",
                                  "secretIds.id",
                                  "secretIds.name",
                                  "id",
                                ]}
                                setBuffer={setBuffer}
                                showFields={["template.name", "name"]}
                                entity_name="resources"
                                bufferKey={String(parent.id)}
                                error={!!errors.parents}
                                helpertext={
                                  errors.parents
                                    ? errors.parents.message
                                    : `Select Parent for Resource ${watchedTemplate.name} (only resources based on ${parent.name} templates will be shown)`
                                }
                                value={
                                  parentSelections[String(parent.id)] || []
                                }
                                filter={{ template_id: [parent.id] }}
                                label={`Select Parent (${parent.name})`}
                                multiple
                                onChange={(selectedIds: string[]) => {
                                  setParentSelections((prev) => {
                                    const next = {
                                      ...prev,
                                      [String(parent.id)]: selectedIds,
                                    };
                                    const merged = Object.values(next).flat();
                                    field.onChange(merged);
                                    return next;
                                  });
                                }}
                              />
                            ))}
                          </>
                        )}
                      />
                      <Controller
                        name="labels"
                        control={control}
                        defaultValue={[]}
                        render={({ field }) => (
                          <LabelInput errors={errors} {...field} />
                        )}
                      />

                      <Controller
                        name="projectId"
                        control={control}
                        render={({ field }) => (
                          <ReferenceInput
                            {...field}
                            ikApi={ikApi}
                            entity_name="projects"
                            buffer={buffer}
                            fields={[
                              "name",
                              "workspace.id",
                              "workspace.name",
                              "workspaceId",
                            ]}
                            showFields={["name"]}
                            setBuffer={setBuffer}
                            error={false}
                            helpertext="Assign this resource to a project."
                            value={field.value}
                            label="Select Project"
                            onChange={(value: any) => field.onChange(value)}
                          />
                        )}
                      />
                    </>
                  )}
                </div>
              </PropertyCard>
            </div>
          )}

          {watchedTemplate?.abstract === false && (
            <div className="w-full" ref={templateConfigSectionRef}>
              <PropertyCard title="Template Configuration">
                <div>
                  {watchedTemplate && watchedTemplate.parents?.length > 0 && (
                    <Controller
                      name="parents"
                      control={control}
                      rules={{ required: "*Required" }}
                      render={({ field }) => (
                        <>
                          {watchedTemplate.parents.map((parent: IkEntity) => (
                            <ArrayReferenceInput
                              key={parent.id}
                              ikApi={ikApi}
                              buffer={buffer}
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
                                "project.id",
                                "project.name",
                                "secretIds.id",
                                "secretIds.name",
                                "id",
                              ]}
                              setBuffer={setBuffer}
                              showFields={["template.name", "name"]}
                              entity_name="resources"
                              bufferKey={String(parent.id)}
                              error={!!errors.parents}
                              helpertext={
                                errors.parents
                                  ? errors.parents.message
                                  : `Select Parent for Resource "${watchedTemplate.name}" (only resources based on ${parent.name} templates will be shown)`
                              }
                              value={parentSelections[String(parent.id)] || []}
                              filter={{ template_id: [parent.id] }}
                              label={`Select Parent (${parent.name})`}
                              multiple
                              onChange={(selectedIds: string[]) => {
                                setParentSelections((prev) => {
                                  const next = {
                                    ...prev,
                                    [String(parent.id)]: selectedIds,
                                  };
                                  const merged = Object.values(next).flat();
                                  field.onChange(merged);
                                  return next;
                                });
                              }}
                            />
                          ))}
                          {watchedParentIds.length > 1 && (
                            <Alert className="mt-2" severity="warning">
                              Multiple parents selected. Integration, storage,
                              and workspace will be taken from the last selected
                              parent. Please make sure this is the intended
                              configuration, as it may cause issues with
                              Terraform state management if different parents
                              have different integrations or storages.
                            </Alert>
                          )}
                        </>
                      )}
                    />
                  )}

                  <Controller
                    name="labels"
                    control={control}
                    defaultValue={[]}
                    render={({ field }) => (
                      <LabelInput errors={errors} {...field} />
                    )}
                  />

                  <Controller
                    name="integrationIds"
                    control={control}
                    rules={{
                      validate: {
                        required: (value: string[]) => {
                          if (integrationRequired && value.length === 0)
                            return "*Required";
                        },
                      },
                    }}
                    render={({ field }) => (
                      <ArrayReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="integrations"
                        filter={{
                          integration_type: "cloud",
                          integration_provider__not_eq: "postgresql",
                        }}
                        showFields={["integrationProvider", "name"]}
                        buffer={buffer}
                        setBuffer={setBuffer}
                        error={!!errors.integrationIds}
                        access="write"
                        includeIds={parentIntegrationIds}
                        helpertext={
                          errors.integrationIds
                            ? (errors.integrationIds as any).message
                            : parentIntegrationIds.length > 0
                              ? "Integrations of the selected parents are available, plus others you have write access to."
                              : "Only integrations you have write access to are shown"
                        }
                        value={field.value}
                        label={`Cloud Integrations. ${
                          integrationRequired
                            ? `Only ${allowedIntegrationTypes.join(", ")} integrations are allowed for this template.`
                            : ""
                        }`}
                        required={integrationRequired}
                        multiple
                        fullWidth
                      />
                    )}
                  />

                  <Controller
                    name="secretIds"
                    control={control}
                    render={({ field }) => (
                      <ArrayReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="secrets"
                        showFields={["name", "secretProvider"]}
                        buffer={buffer}
                        setBuffer={setBuffer}
                        error={!!errors.secretIds}
                        access="write"
                        includeIds={parentSecretIds}
                        helpertext={
                          errors.secretIds
                            ? (errors.secretIds as any).message
                            : parentSecretIds.length > 0
                              ? "Secrets of the selected parents are available, plus others you have write access to."
                              : "Only secrets you have write access to are shown"
                        }
                        value={field.value}
                        label="Select Secrets"
                        multiple
                        fullWidth
                      />
                    )}
                  />

                  <Controller
                    name="storageId"
                    control={control}
                    rules={{ required: "*Required" }}
                    render={({ field }) => (
                      <ReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="storages"
                        buffer={buffer}
                        showFields={["name", "storageProvider"]}
                        fields={["name", "storageProvider", "state"]}
                        getOptionDisabled={(option: any) =>
                          option.state !== "PROVISIONED"
                        }
                        setBuffer={setBuffer}
                        error={!!errors.storageId}
                        helpertext={
                          errors.storageId ? errors.storageId.message : ""
                        }
                        filter={filter_storage}
                        value={field.value}
                        label="Select Storage for storing TF state"
                        required
                      />
                    )}
                  />

                  {watchedStorage && (
                    <Controller
                      name="storagePath"
                      control={control}
                      rules={{
                        validate: {
                          required: (value) => {
                            if (!value) return "*Required";
                          },
                        },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          error={!!errors.storagePath}
                          fullWidth
                          margin="normal"
                          label="Storage Path"
                          helperText={
                            errors.storagePath
                              ? errors.storagePath.message
                              : "By default InfraKitchen uses `service-catalog/{template}/{resource_name}/terraform.tfstate` as the path. You can specify another path if needed (e.g., for migration), but note that this is a frozen field that you can not update later on. If you edit this field, make sure the path is unique within the selected storage."
                          }
                        />
                      )}
                    />
                  )}

                  {watchedStorage && (
                    <Controller
                      name="toolId"
                      control={control}
                      render={({ field }) => (
                        <ToolSelect
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  )}

                  {watchedStorage && (
                    <Controller
                      name="workerTemplateId"
                      control={control}
                      render={({ field }) => (
                        <WorkerTemplateSelect
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  )}

                  <Controller
                    name="projectId"
                    control={control}
                    render={({ field }) => (
                      <ReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="projects"
                        buffer={buffer}
                        fields={[
                          "name",
                          "workspace.id",
                          "workspace.name",
                          "workspaceId",
                        ]}
                        showFields={["name"]}
                        setBuffer={setBuffer}
                        error={false}
                        helpertext="Assign this resource to a project. Workspace will be inherited from the project if not set."
                        value={field.value}
                        label="Select Project"
                        onChange={(value: any) => field.onChange(value)}
                      />
                    )}
                  />

                  <Controller
                    name="workspaceId"
                    control={control}
                    render={({ field }) => (
                      <ReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="workspaces"
                        buffer={buffer}
                        showFields={["name", "workspaceProvider"]}
                        setBuffer={setBuffer}
                        error={!!errors.workspaceId}
                        access="write"
                        includeIds={parentWorkspaceIds}
                        helpertext={
                          errors.workspaceId
                            ? errors.workspaceId.message
                            : parentWorkspaceIds.length > 0
                              ? "Workspaces of the selected parents are available, plus others you have write access to."
                              : "Only workspaces you have write access to are shown"
                        }
                        value={field.value}
                        label="Select Workspace"
                      />
                    )}
                  />
                </div>

                <div>
                  <Controller
                    name="sourceCodeVersionId"
                    control={control}
                    rules={{
                      validate: {
                        required: (value) => {
                          if (!value) return "*Required";
                        },
                      },
                    }}
                    render={({ field }) => (
                      <ReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="source_code_versions"
                        fields={[
                          "identifier",
                          "status",
                          "lifecycleState",
                          "breakingChanges",
                        ]}
                        buffer={buffer}
                        setBuffer={setBuffer}
                        getOptionDisabled={(option: any) =>
                          option.status !== ENTITY_STATUS.DONE
                        }
                        error={!!errors.sourceCodeVersionId}
                        helpertext={
                          errors.sourceCodeVersionId
                            ? errors.sourceCodeVersionId.message
                            : ""
                        }
                        filter={filter_template}
                        sort={["index", "DESC"]}
                        value={field.value}
                        label="Template Version"
                        required
                        disabled={!watchedTemplateId}
                      />
                    )}
                  />
                  {isDeprecatedSourceCodeVersion ? (
                    <Alert className="mt-2" severity="warning">
                      This template version is deprecated. Prefer an active or
                      preview version unless you intentionally need the
                      deprecated one.
                    </Alert>
                  ) : null}
                </div>

                {Array.isArray(schema) && schema.length > 0 && (
                  <div className="mt-4" ref={inputVariablesSectionRef}>
                    <BaseCard
                      name="Input Variables"
                      chip={String(schema?.length || 0)}
                      chipColor="default"
                    >
                      <div className="col-span-full">
                        {fields.map((field, index) =>
                          schema && schema[index] ? (
                            <ResourceVariableForm
                              key={field.id}
                              index={index}
                              variable={schema[index]}
                              validationSummary={
                                validationRuleSummaryByVariable[
                                  schema[index].name
                                ] || null
                              }
                              validationRule={
                                validationRuleByVariable[schema[index].name] ||
                                null
                              }
                            />
                          ) : null,
                        )}
                      </div>
                    </BaseCard>
                  </div>
                )}
                {isLoading && <GradientCircularProgress />}
              </PropertyCard>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

const ResourceCreatePage = () => {
  const location = useLocation();
  const template = location.state?.template as GqlTemplateShort | undefined;
  const cloneSource = location.state?.clone as GqlResource | undefined;

  const methods = useForm<ResourceCreate>({
    defaultValues: cloneSource
      ? toCloneDefaults(cloneSource)
      : {
          name: "",
          description: "",
          templateId: template?.id,
          parents: [],
          integrationIds: [],
          sourceCodeVersionId: "",
          variables: [],
          workspaceId: "",
          projectId: "",
          dependencyTags: [],
          dependencyConfig: [],
          storageId: "",
          storagePath: "",
          toolId: "",
          workerTemplateId: "",
        },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <ResourceCreatePageInner />
    </FormProvider>
  );
};

ResourceCreatePage.path = "/resources/create";

export { ResourceCreatePage };
