import { useState, useEffect, useMemo, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
  useFieldArray,
} from "react-hook-form";
import { useLocation, useNavigate } from "react-router";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
} from "@mui/material";

import { GradientCircularProgress, LabelInput } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import TagInput from "../../common/components/inputs/TagInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { TemplateResponse } from "../../templates/types";
import { IkEntity } from "../../types";
import { ResourceVariableForm } from "../components/variables/ResourceVariablesForm";
import {
  ResourceCreate,
  ResourceResponse,
  ResourceVariableSchema,
} from "../types";

const ResourceCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    trigger,
    setValue,
    getValues,
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
  const navigate = useNavigate();
  const location = useLocation();

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
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }
      ikApi
        .postRaw("resources", data)
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
    [ikApi, navigate, trigger, setSaving, linkPrefix],
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

  const filter_storage = useMemo(
    () => ({
      integration_id: watchedIntegrationIds ? watchedIntegrationIds : [],
    }),
    [watchedIntegrationIds],
  );

  const filter_parents = useMemo(
    () => ({
      template_id: watchedTemplate ? watchedTemplate.parents : [],
    }),
    [watchedTemplate],
  );

  const filter_template = useMemo(
    () => ({
      template_id: watchedTemplateId,
    }),
    [watchedTemplateId],
  );

  const watchedName = watch("name");

  useEffect(() => {
    setValue("source_code_version_id", null);
  }, [watchedTemplateId, setValue]);

  useEffect(() => {
    if (watchedTemplate) {
      setValue("storage_id", watchedTemplate.storage_id);
      setValue("workspace_id", watchedTemplate.workspace_id);
    }
  }, [watchedTemplate, setValue]);

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

  useEffect(() => {
    if (watchedParentIds.length > 0) {
      const parentObjects = buffer["resources"]?.find((e: ResourceResponse) =>
        watchedParentIds.includes(e.id),
      );

      if (!parentObjects) {
        return;
      }

      const parentIntegrations =
        parentObjects.integration_ids.map(
          (integration: { id: string }) => integration.id,
        ) || [];

      const parentStorage = parentObjects?.storage?.id || null;
      const parentWorkspace = parentObjects?.workspace?.id || null;

      if (
        parentIntegrations.length > 0 &&
        getValues("integration_ids").length === 0
      ) {
        setValue("integration_ids", parentIntegrations);
      }

      setValue("storage_id", parentStorage);
      setValue("workspace_id", parentWorkspace);
    }
  }, [watchedParentIds, setValue, getValues, buffer]);

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
            onClick={handleSubmit(handleSave)}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          width: "100%",
          minWidth: 320,
        }}
      >
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
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  required
                  placeholder="Enter resource name. It should be unique within the selected template."
                  variant="outlined"
                  error={!!errors.name}
                  fullWidth
                  margin="normal"
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

        <PropertyCard title="Dependency Configuration">
          <Box>
            <Controller
              name="dependency_tags"
              control={control}
              render={({ field }) => (
                <TagInput {...field} label="Dependency Tags" errors={errors} />
              )}
            />
            <Controller
              name="dependency_config"
              control={control}
              render={({ field }) => (
                <TagInput
                  {...field}
                  label="Dependency Configs"
                  errors={errors}
                />
              )}
            />
          </Box>
        </PropertyCard>
        {watchedTemplate?.abstract === true && (
          <PropertyCard title="Template Configuration">
            <Box>
              {watchedTemplate && watchedTemplate.parents?.length > 0 && (
                <>
                  <Controller
                    name="parents"
                    control={control}
                    rules={{ required: "*Required" }}
                    render={({ field }) => (
                      <ArrayReferenceInput
                        ikApi={ikApi}
                        buffer={buffer}
                        setBuffer={setBuffer}
                        showFields={["template.name", "name"]}
                        {...field}
                        entity_name="resources"
                        error={!!errors.parents}
                        helpertext={
                          errors.parents
                            ? errors.parents.message
                            : "Select Parents for Resource"
                        }
                        value={field.value}
                        filter={filter_parents}
                        label="Select Parents"
                        multiple
                      />
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
        )}

        {watchedTemplate?.abstract === false && (
          <PropertyCard title="Template Configuration">
            <Box>
              {watchedTemplate && watchedTemplate.parents?.length > 0 && (
                <Controller
                  name="parents"
                  control={control}
                  rules={{ required: "*Required" }}
                  render={({ field }) => (
                    <ArrayReferenceInput
                      ikApi={ikApi}
                      buffer={buffer}
                      setBuffer={setBuffer}
                      showFields={["template.name", "name"]}
                      {...field}
                      entity_name="resources"
                      error={!!errors.parents}
                      helpertext={
                        errors.parents
                          ? errors.parents.message
                          : "Select Parents for Resource"
                      }
                      value={field.value}
                      filter={filter_parents}
                      label="Select Parents"
                      multiple
                    />
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
                    showFields={["integration_provider", "name"]}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    error={!!errors.integration_ids}
                    helpertext={
                      errors.integration_ids
                        ? (errors.integration_ids as any).message
                        : ""
                    }
                    value={field.value}
                    label="Cloud Integration"
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
                    helpertext={
                      errors.workspace_id
                        ? errors.workspace_id.message
                        : "Select Workspace"
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
        )}
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
