import { useEffect, useState, useCallback, useMemo } from "react";

import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Button,
  Box,
  TextField,
  Alert,
  Typography,
  IconButton,
  Tooltip,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Table,
  TableBody,
} from "@mui/material";

import { LabelInput, PermissionWrapper, useConfig } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import TagInput from "../../common/components/inputs/TagInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  IkEntity,
  ValidationRule,
  ValidationRulesByVariable,
} from "../../types";
import { ResourceVariableForm } from "../components/variables/ResourceVariablesForm";
import {
  ResourceResponse,
  ResourceTempStateResponse,
  ResourceUpdate,
  ResourceVariableSchema,
} from "../types";
import { buildValidationRuleMaps } from "../utils/validationRules";

export const ResourceEditPageInner = (props: {
  entity: ResourceResponse;
  resourceTempState?: ResourceTempStateResponse;
}) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity, resourceTempState } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}resources/${entity.id}`);
  const [variablesOpen, setVariablesOpen] = useState(true);

  const getEntityDefaultValues = useCallback(
    (entity: ResourceResponse): ResourceUpdate => {
      return {
        name: entity.name,
        description: entity.description,
        integration_ids: entity.integration_ids.map((i) => i.id),
        secret_ids: entity.secret_ids.map((s) => s.id),
        source_code_version_id: entity.source_code_version?.id || null,
        dependency_config: entity.dependency_config,
        dependency_tags: entity.dependency_tags,
        variables: entity.variables as unknown as ResourceVariableSchema[],
        workspace_id: entity.workspace?.id || null,
        labels: entity.labels,
        storage_id: entity.storage?.id || null,
        storage_path: entity.storage_path,
      };
    },
    [],
  );

  const parseTempState = useCallback(
    (tempState: ResourceTempStateResponse): Partial<ResourceUpdate> | null => {
      if (!tempState?.value) {
        return null;
      }

      try {
        const parsedValue =
          typeof tempState.value === "string"
            ? JSON.parse(tempState.value)
            : tempState.value;

        if (
          typeof parsedValue !== "object" ||
          parsedValue === null ||
          Array.isArray(parsedValue)
        ) {
          throw new Error("Temp state value is not a valid object:", {
            cause: parsedValue,
          });
        }

        return parsedValue as Partial<ResourceUpdate>;
      } catch (error) {
        throw new Error("Failed to parse resourceTempState.value:", {
          cause: error,
        });
      }
    },
    [],
  );

  const getMergedDefaultValues = useCallback((): ResourceUpdate => {
    const entityDefaults = getEntityDefaultValues(entity);
    const tempStateValues = resourceTempState
      ? parseTempState(resourceTempState)
      : null;

    if (!tempStateValues) {
      return entityDefaults;
    }

    return {
      ...entityDefaults,
      ...tempStateValues,
      integration_ids:
        tempStateValues.integration_ids || entityDefaults.integration_ids,
    };
  }, [entity, resourceTempState, getEntityDefaultValues, parseTempState]);

  const methods = useForm<ResourceUpdate>({
    mode: "onChange",
    defaultValues: getMergedDefaultValues(),
  });

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors, dirtyFields, isDirty },
    watch,
    reset,
  } = methods;

  const watchedSourceCodeVersionId = watch("source_code_version_id");

  const watchedIntegrationIds = watch("integration_ids");
  const watchedStorage = watch("storage_id");
  const [isStorageEditable, setIsStorageEditable] = useState(false);
  const filter_storage = useMemo(
    () => ({
      integration_id: watchedIntegrationIds ? watchedIntegrationIds : [],
    }),
    [watchedIntegrationIds],
  );

  useEffect(() => {
    const mergedValues = getMergedDefaultValues();
    reset(mergedValues);
  }, [resourceTempState, getMergedDefaultValues, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variables",
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const [schema, setSchema] = useState<ResourceVariableSchema[]>();
  const [validationRuleSummaryByVariable, setValidationRuleSummaryByVariable] =
    useState<Record<string, string>>({});
  const [validationRuleByVariable, setValidationRuleByVariable] = useState<
    Record<string, ValidationRule | null>
  >({});

  function getSchemaObject(schema: ResourceVariableSchema[]) {
    return schema.reduce((acc: Record<string, any>, variable) => {
      acc[variable.name] = variable;
      return acc;
    }, {});
  }

  const onSubmit = useCallback(
    async (data: ResourceUpdate) => {
      if (!entity) return;

      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Please fill in all required fields"));
        return;
      }

      if (!isDirty) {
        notify("No changes detected", "info");
        return;
      }

      const changedFields: Partial<ResourceUpdate> = {};

      (Object.keys(dirtyFields || {}) as Array<keyof ResourceUpdate>).forEach(
        (fieldName) => {
          (changedFields as any)[fieldName] = data[fieldName];
        },
      );

      if (Object.keys(changedFields).length === 0) {
        notify("No changes detected", "info");
        return;
      }

      try {
        const response = await ikApi.patchRaw(`resources/${entity.id}`, data);
        if (response.id) {
          notify("Resource updated successfully", "success");
          navigate(`${linkPrefix}resources/${response.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [entity, trigger, isDirty, ikApi, linkPrefix, dirtyFields, navigate],
  );

  useEffect(() => {
    if (watchedSourceCodeVersionId && entity.parents) {
      ikApi
        .getVariableSchema(
          watchedSourceCodeVersionId,
          entity.parents.map((p) => p.id),
        )
        .then((response: ResourceVariableSchema[]) => {
          setSchema(response);
          const schemaVariableNames = new Set(response.map((v) => v.name));
          const variablesToAdd: any[] = [];
          const indicesToRemove: number[] = [];

          // Identify fields to keep and fields to remove
          fields.forEach((field, index) => {
            if (!schemaVariableNames.has(field.name)) {
              indicesToRemove.push(index);
            }
          });
          indicesToRemove.reverse().forEach((index) => {
            remove(index);
          });

          // Identify fields to add
          const currentVariableNamesAfterRemoval = new Set(
            fields.map((f) => f.name),
          );

          response.forEach((schemaVariable) => {
            if (!currentVariableNamesAfterRemoval.has(schemaVariable.name)) {
              // Find if it was one of the original fields OR one of the fields that survived removal.
              const namesInCurrentFields = new Set(fields.map((f) => f.name));

              if (!namesInCurrentFields.has(schemaVariable.name)) {
                variablesToAdd.push({
                  name: schemaVariable.name,
                  value: schemaVariable.value ?? null,
                } as any);
              }
            }
          });

          if (variablesToAdd.length > 0) {
            append(variablesToAdd);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    }
  }, [
    ikApi,
    watchedSourceCodeVersionId,
    entity,
    setSchema,
    append,
    fields,
    remove,
  ]);

  useEffect(() => {
    if (!entity.template.id) {
      setValidationRuleSummaryByVariable({});
      setValidationRuleByVariable({});
      return;
    }

    ikApi
      .get(`validation_rules/template/${entity.template.id}`)
      .then((response: ValidationRulesByVariable[]) => {
        const { summaryByVariable, ruleByVariable } =
          buildValidationRuleMaps(response);

        setValidationRuleSummaryByVariable(summaryByVariable);
        setValidationRuleByVariable(ruleByVariable);
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [ikApi, entity.template.id]);

  return (
    <FormProvider {...methods}>
      <PageContainer
        title="Edit Resource"
        onBack={handleBack}
        backAriaLabel="Back to resource"
        bottomActions={
          <>
            <Button variant="outlined" color="primary" onClick={handleBack}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(onSubmit)}
            >
              Update
            </Button>
          </>
        }
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            width: "75%",
            minWidth: 320,
            maxWidth: 1000,
          }}
        >
          <PropertyCard title="Resource Definition">
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
                  helperText={
                    errors.name
                      ? errors.name.message
                      : "It should be unique within the selected template."
                  }
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
                  variant="outlined"
                  error={!!errors.description}
                  helperText={
                    errors.description
                      ? errors.description.message
                      : "Description of the resource"
                  }
                  fullWidth
                  margin="normal"
                />
              )}
            />
          </PropertyCard>
          <PropertyCard title="Template Configuration">
            {entity.abstract === true && (
              <Controller
                name="labels"
                control={control}
                defaultValue={[]}
                render={({ field }) => (
                  <LabelInput errors={errors} {...field} />
                )}
              />
            )}

            {entity?.abstract === false && (
              <>
                <Controller
                  name="integration_ids"
                  control={control}
                  render={({ field }) => (
                    <ArrayReferenceInput
                      {...field}
                      ikApi={ikApi}
                      entity_name="integrations"
                      buffer={buffer}
                      setBuffer={setBuffer}
                      error={!!errors.integration_ids}
                      helpertext={
                        errors.integration_ids
                          ? errors.integration_ids.message
                          : "Select Credentials for the resource"
                      }
                      value={field.value}
                      label="Credentials"
                      multiple
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
                      buffer={buffer}
                      setBuffer={setBuffer}
                      error={!!errors.secret_ids}
                      helpertext={
                        errors.secret_ids
                          ? errors.secret_ids.message
                          : "Select Secret for the resource"
                      }
                      value={field.value}
                      label="Secrets"
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

            {entity?.abstract === false && (
              <>
                <Typography variant="h5" component="h3">
                  Template version
                </Typography>
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
                            : "Select Source Code Version"
                        }
                        filter={{ template_id: entity.template.id }}
                        value={field.value}
                        label="Source Code Version"
                      />
                    )}
                  />
                  <PermissionWrapper
                    requiredPermission="storage"
                    permissionAction="admin"
                  >
                    {watchedIntegrationIds.length > 0 && (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mt: 1,
                          }}
                        >
                          <Tooltip
                            title={
                              isStorageEditable
                                ? "Lock storage field"
                                : "Unlock storage field"
                            }
                          >
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() =>
                                setIsStorageEditable((editable) => !editable)
                              }
                            >
                              {isStorageEditable ? (
                                <LockOpenOutlinedIcon fontSize="small" />
                              ) : (
                                <LockOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Typography variant="body2" color="warning.main">
                            {isStorageEditable
                              ? "Storage editing is enabled. Changing storage can cause OpenTofu/Terraform state issues."
                              : "Storage is locked. Click the lock icon to edit. Changing storage can cause OpenTofu/Terraform state issues."}
                          </Typography>
                        </Box>
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
                                errors.storage_id
                                  ? errors.storage_id.message
                                  : "Keep this value unchanged unless you are intentionally migrating OpenTofu/Terraform state."
                              }
                              filter={filter_storage}
                              value={field.value}
                              label="Select Storage for storing TF state"
                              required
                              readOnly={!isStorageEditable}
                            />
                          )}
                        />
                      </>
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
                            disabled={!isStorageEditable}
                            helperText={
                              errors.storage_path
                                ? errors.storage_path.message
                                : "By default InfraKitchen uses `service-catalog/{template}/{resource_name}/terraform.tfstate` as the path. You can specify another path if needed (e.g., for migration), but note that this is a frozen field that you can not update later on. If you edit this field, make sure the path is unique within the selected storage."
                            }
                          />
                        )}
                      />
                    )}
                  </PermissionWrapper>

                  <Controller
                    name="workspace_id"
                    control={control}
                    render={({ field }) => (
                      <ReferenceInput
                        {...field}
                        ikApi={ikApi}
                        showFields={["name", "workspace_provider"]}
                        entity_name="workspaces"
                        buffer={buffer}
                        setBuffer={setBuffer}
                        error={!!errors.workspace_id}
                        helpertext={
                          errors.workspace_id
                            ? errors.workspace_id.message
                            : "Select Workspace"
                        }
                        value={field.value}
                        label="Workspace"
                      />
                    )}
                  />
                </Box>
              </>
            )}
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
          </PropertyCard>
          {entity.abstract === false && (
            <PropertyCard title="Input Variables">
              {Array.isArray(schema) && schema.length > 0 && (
                <Accordion
                  expanded={variablesOpen}
                  onChange={() => setVariablesOpen(!variablesOpen)}
                  elevation={0}
                  sx={{
                    "&:before": {
                      display: "none",
                    },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h5" component="h4">
                      Input variables
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
                              edit_mode={true}
                              variable={
                                getSchemaObject(schema)[field.name] || {}
                              }
                              validationSummary={
                                validationRuleSummaryByVariable[field.name] ||
                                null
                              }
                              validationRule={
                                validationRuleByVariable[field.name] || null
                              }
                            />
                          ) : null,
                        )}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              )}
            </PropertyCard>
          )}
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const ResourceEditPage = () => {
  const { resource_id } = useParams();

  const [entity, setEntity] = useState<ResourceResponse>();
  const [resourceTempState, setResourceTempState] =
    useState<ResourceTempStateResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getResource = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`resources/${resource_id}`)
      .then((response) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, resource_id]);

  useEffectOnce(() => {
    getResource();
  });

  const getResourceTempState = useCallback(async (): Promise<any> => {
    if (!resource_id) return;
    await ikApi
      .get(`resource_temp_states/resource/${resource_id}`)
      .then((response) => {
        setResourceTempState(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, resource_id]);

  useEffectOnce(() => {
    getResourceTempState();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && (
        <ResourceEditPageInner
          entity={entity}
          resourceTempState={resourceTempState}
        />
      )}
    </>
  );
};
ResourceEditPage.path = "/resources/:resource_id/edit";
