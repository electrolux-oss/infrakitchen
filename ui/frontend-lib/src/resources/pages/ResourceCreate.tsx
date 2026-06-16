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

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Box,
  Typography,
  TextField,
  AccordionDetails,
  Accordion,
  AccordionSummary,
  Table,
  TableBody,
  Button,
  Alert,
  IconButton,
  InputAdornment,
  Card,
  CardContent,
  Chip,
} from "@mui/material";

import { GradientCircularProgress, LabelInput } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import TagInput from "../../common/components/inputs/TagInput";
import { MarkdownViewer } from "../../common/components/MarkdownViewer";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { TemplateResponse } from "../../templates/types";
import { IkEntity } from "../../types";
import { ValidationRule, ValidationRulesByVariable } from "../../types";
import { ResourceVariableForm } from "../components/variables/ResourceVariablesForm";
import {
  ResourceCreate,
  ResourceResponse,
  ResourceVariableSchema,
} from "../types";
import {
  getFirstErrorFieldPath,
  validateTagEntries,
} from "../utils/formValidation";
import { buildValidationRuleMaps } from "../utils/validationRules";

const ResourceCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const { permissions } = usePermissionProvider();
  const {
    control,
    formState: { errors },
    watch,
    setValue,
    handleSubmit,
  } = useFormContext<ResourceCreate>();

  const { fields } = useFieldArray({
    control,
    name: "variables",
  });

  const [variablesOpen, setVariablesOpen] = useState(true);
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
  const [parentSelections, setParentSelections] = useState<
    Record<string, string[]>
  >({});

  const [namingConvention, setNamingConvention] = useState(null);
  const [namingConventionEditable, setNamingConventionEditable] =
    useState(true);

  const resourceDefinitionSectionRef = useRef<HTMLDivElement>(null);
  const dependencyTagsSectionRef = useRef<HTMLDivElement>(null);
  const dependencyConfigSectionRef = useRef<HTMLDivElement>(null);
  const templateConfigSectionRef = useRef<HTMLDivElement>(null);
  const inputVariablesSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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
        template_id: resourceDefinitionSectionRef,
        name: resourceDefinitionSectionRef,
        description: resourceDefinitionSectionRef,
        dependency_tags: dependencyTagsSectionRef,
        dependency_config: dependencyConfigSectionRef,
      };

      if (rootField === "variables") {
        setVariablesOpen(true);
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
    [setVariablesOpen],
  );

  useEffect(() => {
    const template_id = location.state?.template_id as string | undefined;
    if (template_id) {
      setValue("template_id", template_id);
    }
  }, [location.state, setValue]);

  const handleBack = () => navigate(`${linkPrefix}resources`);

  const handleSave = useCallback(
    async (data: ResourceCreate) => {
      setSaving(true);
      const payload: ResourceCreate = {
        ...data,
        storage_id: data.storage_id || null,
        workspace_id: data.workspace_id || null,
        source_code_version_id: data.source_code_version_id || null,
      };
      ikApi
        .postRaw("resources", payload)
        .then((response: ResourceResponse) => {
          if (response.id) {
            notify("Resource created successfully", "success");
            navigate(`${linkPrefix}resources/${response.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [ikApi, navigate, setSaving, linkPrefix],
  );

  const handleInvalidSave = useCallback(
    (submitErrors: Record<string, any>) => {
      scrollToErrorSection(submitErrors);
      notifyError(new Error("Please fix the errors in the form"));
    },
    [scrollToErrorSection],
  );

  const watchedIntegrationIds = watch("integration_ids");
  const watchedTemplateId = watch("template_id");
  const watchedTemplate =
    buffer["templates"]?.find(
      (e: TemplateResponse) => e.id === watchedTemplateId,
    ) || null;
  const watchedStorage = watch("storage_id");
  const watchedParentIds = watch("parents");
  const watchedSourceCodeVersionId = watch("source_code_version_id");
  const hasDocs = Boolean(watchedTemplate?.documentation);

  const filter_storage = useMemo(
    () => ({
      integration_id: watchedIntegrationIds ? watchedIntegrationIds : [],
    }),
    [watchedIntegrationIds],
  );

  const filter_template = useMemo(
    () => ({
      template_id: watchedTemplateId,
    }),
    [watchedTemplateId],
  );

  const watchedName = watch("name");

  const integrationWriteFilter = useMemo(
    () => (option: IkEntity) => {
      if (permissions["*"] === "admin") return true;
      const p = permissions[`integration:${option.id}`];
      return p === "write" || p === "admin";
    },
    [permissions],
  );

  const workspaceWriteFilter = useMemo(
    () => (option: IkEntity) => {
      if (permissions["*"] === "admin") return true;
      const p = permissions[`workspace:${option.id}`];
      return p === "write" || p === "admin";
    },
    [permissions],
  );

  useEffect(() => {
    if (watchedTemplate?.configuration?.namingConvention) {
      setNamingConvention(watchedTemplate.configuration.namingConvention);
      setValue("name", watchedTemplate.configuration.namingConvention, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setNamingConventionEditable(false);
    }
  }, [watchedTemplate, setValue]);

  useEffect(() => {
    setValue("source_code_version_id", null);
  }, [watchedTemplateId, setValue]);

  useEffect(() => {
    const requiredVars =
      watchedTemplate?.configuration?.requiredConfigurationVariables || [];
    if (requiredVars.length === 0) return;
    const currentConfig = (watch("dependency_config") || []) as Array<{
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
      setValue("dependency_config", [...currentConfig, ...newEntries]);
    }
  }, [watchedTemplate, setValue, watch]);

  useEffect(() => {
    setParentSelections({});
    setValue("parents", [], { shouldValidate: true });
  }, [watchedTemplateId, setValue]);

  useEffect(() => {
    if (watchedTemplate) {
      setValue(
        "storage_path",
        `service-catalog/${watchedTemplate.template}/${watchedName}/terraform.tfstate`.replaceAll(
          " ",
          "_",
        ),
      );
    }
  }, [watchedName, watchedTemplate, setValue]);

  const resolvedLastParent = useMemo(() => {
    if (watchedParentIds.length === 0) return null;
    const parentCandidates = watchedTemplate?.parents
      ? watchedTemplate.parents.flatMap(
          (parent: IkEntity) => (buffer[String(parent.id)] as IkEntity[]) || [],
        )
      : [];
    const primaryParentId = watchedParentIds.at(-1);
    return (
      parentCandidates.find(
        (e: ResourceResponse) => String(e.id) === String(primaryParentId),
      ) || null
    );
  }, [watchedParentIds, watchedTemplate, buffer]);

  const inherited = useMemo(() => {
    const parent = resolvedLastParent as ResourceResponse | null;
    const integrationIds = parent?.integration_ids?.map((i) => i.id) || [];
    return {
      integration: integrationIds.length > 0,
      storage: Boolean(parent?.storage?.id),
      workspace: Boolean(parent?.workspace?.id),
      integrationIds,
      storageId: parent?.storage?.id || null,
      workspaceId: parent?.workspace?.id || null,
    };
  }, [resolvedLastParent]);

  const lastAppliedParentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resolvedLastParent) {
      lastAppliedParentIdRef.current = null;
      return;
    }
    const parentId = String((resolvedLastParent as IkEntity).id);
    if (lastAppliedParentIdRef.current === parentId) return;
    lastAppliedParentIdRef.current = parentId;
    if (inherited.integration) {
      setValue("integration_ids", inherited.integrationIds);
    }
    if (inherited.storage) {
      setValue("storage_id", inherited.storageId);
    }
    if (inherited.workspace) {
      setValue("workspace_id", inherited.workspaceId);
    }
  }, [resolvedLastParent, inherited, setValue]);

  useEffect(() => {
    if (watchedSourceCodeVersionId) {
      setIsLoading(true);
      ikApi
        .getVariableSchema(
          watchedSourceCodeVersionId,
          watchedParentIds ? watchedParentIds : [],
        )
        .then((response: ResourceVariableSchema[]) => {
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
          setValue("variables", response);
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
    setSchema,
    setValue,
  ]);

  useEffect(() => {
    if (!watchedTemplateId) {
      setValidationRuleSummaryByVariable({});
      setValidationRuleByVariable({});
      return;
    }

    ikApi
      .get(`validation_rules/template/${watchedTemplateId}`)
      .then((response: ValidationRulesByVariable[]) => {
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
      title="Create Resource"
      onBack={handleBack}
      backAriaLabel="Back to resources"
      bottomActions={
        <>
          <Button variant="outlined" onClick={handleBack}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(handleSave, handleInvalidSave)}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          flexDirection: "column",
          gap: 2,
          width: "100%",
          minWidth: 320,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            width: "100%",
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <Box ref={resourceDefinitionSectionRef} sx={{ width: "100%" }}>
            <PropertyCard title="Resource Definition">
              <Box>
                <Controller
                  name="template_id"
                  control={control}
                  rules={{ required: "*Required" }}
                  render={({ field }) => (
                    <ReferenceInput
                      {...field}
                      ikApi={ikApi}
                      entity_name="templates"
                      buffer={buffer}
                      setBuffer={setBuffer}
                      error={!!errors.template_id}
                      value={field.value}
                      label="Template"
                      required
                      fullWidth
                    />
                  )}
                />
                {hasDocs && (
                  <Card
                    sx={{
                      mt: 2,
                      position: "relative",
                      overflow: "visible",
                    }}
                  >
                    <Chip
                      label="Template Documentation"
                      size="small"
                      color="info"
                      variant="filled"
                      sx={{
                        position: "absolute",
                        top: -10,
                        left: 16,
                        zIndex: 1,
                      }}
                    />
                    <CardContent sx={{ pt: 0 }}>
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
                      variant="outlined"
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
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              {namingConvention && (
                                <IconButton
                                  size="small"
                                  color="warning"
                                  edge="end"
                                  onClick={() =>
                                    setNamingConventionEditable(
                                      (editable) => !editable,
                                    )
                                  }
                                >
                                  {namingConventionEditable ? (
                                    <LockOpenOutlinedIcon fontSize="small" />
                                  ) : (
                                    <LockOutlinedIcon fontSize="small" />
                                  )}
                                </IconButton>
                              )}
                            </InputAdornment>
                          ),
                        },
                      }}
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
                      variant="outlined"
                      error={!!errors.description}
                      fullWidth
                      margin="normal"
                    />
                  )}
                />
              </Box>
            </PropertyCard>
          </Box>

          <Box sx={{ width: "100%" }}>
            <PropertyCard title="Dependency Configuration">
              <Box>
                <Box ref={dependencyTagsSectionRef}>
                  <Controller
                    name="dependency_tags"
                    control={control}
                    rules={{
                      validate: {
                        requiredFields: (value) => validateTagEntries(value),
                      },
                    }}
                    render={({ field, formState }) => (
                      <TagInput
                        {...field}
                        label="Dependency Tags"
                        errors={errors}
                        showErrors={formState.isSubmitted}
                      />
                    )}
                  />
                </Box>
                <Box ref={dependencyConfigSectionRef}>
                  <Controller
                    name="dependency_config"
                    control={control}
                    rules={{
                      validate: {
                        requiredFields: (value) => validateTagEntries(value),
                        requiredConfigVars: (value) => {
                          const required =
                            watchedTemplate?.configuration
                              ?.requiredConfigurationVariables;
                          if (!required || required.length === 0) return true;
                          const provided = new Set(
                            (value || []).map(
                              (v) => (v as { name: string }).name,
                            ),
                          );
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
                    render={({ field, formState }) => (
                      <TagInput
                        {...field}
                        label="Dependency Configs"
                        errors={errors}
                        showErrors={formState.isSubmitted}
                      />
                    )}
                  />
                </Box>
              </Box>
            </PropertyCard>
          </Box>
          {watchedTemplate?.abstract === true && (
            <Box ref={templateConfigSectionRef} sx={{ width: "100%" }}>
              <PropertyCard title="Template Configuration">
                <Box>
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
                                  "template",
                                  "integration_ids",
                                  "storage",
                                  "workspace",
                                  "secret_ids",
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
                    </>
                  )}
                </Box>
              </PropertyCard>
            </Box>
          )}

          {watchedTemplate?.abstract === false && (
            <Box ref={templateConfigSectionRef} sx={{ width: "100%" }}>
              <PropertyCard title="Template Configuration">
                <Box>
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
                                "template",
                                "integration_ids",
                                "storage",
                                "workspace",
                                "secret_ids",
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
                            <Alert severity="warning" sx={{ mt: 1 }}>
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
                    name="integration_ids"
                    control={control}
                    rules={{
                      validate: {
                        required: (value: string[]) => {
                          if (value.length === 0) return "*Required";
                        },
                      },
                    }}
                    render={({ field }) => (
                      <ArrayReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="integrations"
                        filter={{ integration_type: "cloud" }}
                        showFields={["integrationProvider", "name"]}
                        buffer={buffer}
                        setBuffer={setBuffer}
                        error={!!errors.integration_ids}
                        optionFilter={(option: IkEntity) => {
                          if (
                            inherited.integration &&
                            inherited.integrationIds.includes(option.id)
                          ) {
                            return true;
                          }
                          return integrationWriteFilter(option);
                        }}
                        helpertext={
                          errors.integration_ids
                            ? (errors.integration_ids as any).message
                            : inherited.integration
                              ? "Pre-filled from parent. You can remove inherited integrations or add others you have write access to."
                              : "Only integrations you have write access to are shown"
                        }
                        value={field.value}
                        label={`Cloud Integrations. ${
                          watchedTemplate?.configuration
                            .allowedProviderIntegrationTypes
                            ? `Only ${watchedTemplate.configuration.allowedProviderIntegrationTypes.join(", ")} integrations are allowed for this template.`
                            : ""
                        }`}
                        required
                        multiple
                        fullWidth
                      />
                    )}
                  />

                  <Controller
                    name="secret_ids"
                    control={control}
                    render={({ field }) => (
                      <ArrayReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="secrets"
                        showFields={["name", "secret_provider"]}
                        buffer={buffer}
                        setBuffer={setBuffer}
                        error={!!errors.secret_ids}
                        helpertext={
                          errors.secret_ids
                            ? (errors.secret_ids as any).message
                            : "Select Secrets"
                        }
                        value={field.value}
                        label="Select Secrets"
                        multiple
                        fullWidth
                      />
                    )}
                  />

                  {watchedIntegrationIds.length > 0 && (
                    <Controller
                      name="storage_id"
                      control={control}
                      rules={{ required: "*Required" }}
                      render={({ field }) => (
                        <ReferenceInput
                          {...field}
                          ikApi={ikApi}
                          entity_name="storages"
                          buffer={buffer}
                          showFields={["name", "storage_provider"]}
                          setBuffer={setBuffer}
                          error={!!errors.storage_id}
                          helpertext={
                            errors.storage_id ? errors.storage_id.message : ""
                          }
                          filter={filter_storage}
                          value={field.value}
                          label="Select Storage for storing TF state"
                          required
                        />
                      )}
                    />
                  )}

                  {watchedStorage && (
                    <Controller
                      name="storage_path"
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
                          error={!!errors.storage_path}
                          fullWidth
                          margin="normal"
                          label="Storage Path"
                          helperText={
                            errors.storage_path
                              ? errors.storage_path.message
                              : "By default InfraKitchen uses `service-catalog/{template}/{resource_name}/terraform.tfstate` as the path. You can specify another path if needed (e.g., for migration), but note that this is a frozen field that you can not update later on. If you edit this field, make sure the path is unique within the selected storage."
                          }
                        />
                      )}
                    />
                  )}

                  <Controller
                    name="workspace_id"
                    control={control}
                    render={({ field }) => (
                      <ReferenceInput
                        {...field}
                        ikApi={ikApi}
                        entity_name="workspaces"
                        buffer={buffer}
                        showFields={["name", "workspace_provider"]}
                        setBuffer={setBuffer}
                        error={!!errors.workspace_id}
                        optionFilter={workspaceWriteFilter}
                        helpertext={
                          errors.workspace_id
                            ? errors.workspace_id.message
                            : "Only workspaces you have write access to are shown"
                        }
                        value={field.value}
                        label="Select Workspace"
                      />
                    )}
                  />
                </Box>

                <Box>
                  <Controller
                    name="source_code_version_id"
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
                        buffer={buffer}
                        setBuffer={setBuffer}
                        getOptionDisabled={(option: any) =>
                          option.status !== "done"
                        }
                        error={!!errors.source_code_version_id}
                        helpertext={
                          errors.source_code_version_id
                            ? errors.source_code_version_id.message
                            : ""
                        }
                        filter={filter_template}
                        value={field.value}
                        label="Template Version"
                        required
                        disabled={!watchedTemplateId}
                      />
                    )}
                  />
                </Box>

                {Array.isArray(schema) && schema.length > 0 && (
                  <Accordion
                    ref={inputVariablesSectionRef}
                    expanded={variablesOpen}
                    onChange={() => setVariablesOpen(!variablesOpen)}
                    elevation={0}
                    sx={{
                      borderRadius: 1,
                      mt: 2,
                      "&:before": {
                        display: "none",
                      },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h5" component="h4">
                        Input Variables ({schema?.length || 0})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Table>
                        <TableBody>
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
                                  validationRuleByVariable[
                                    schema[index].name
                                  ] || null
                                }
                              />
                            ) : null,
                          )}
                        </TableBody>
                      </Table>
                    </AccordionDetails>
                  </Accordion>
                )}
                {isLoading && <GradientCircularProgress />}
              </PropertyCard>
            </Box>
          )}
        </Box>
      </Box>
    </PageContainer>
  );
};

const ResourceCreatePage = () => {
  const location = useLocation();
  const template = location.state?.template as TemplateResponse | undefined;

  const methods = useForm<ResourceCreate>({
    defaultValues: {
      name: "",
      description: "",
      template_id: template?.id,
      parents: [],
      integration_ids: [],
      source_code_version_id: "",
      variables: [],
      workspace_id: "",
      dependency_tags: [],
      dependency_config: [],
      storage_id: "",
      storage_path: "",
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
