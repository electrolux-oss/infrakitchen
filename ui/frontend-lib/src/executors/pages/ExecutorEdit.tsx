import { useEffect, useState, useCallback, useMemo, useRef } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Button,
  Box,
  TextField,
  Alert,
  Typography,
  MenuItem,
  Autocomplete,
  IconButton,
  Tooltip,
} from "@mui/material";

import { LabelInput, PermissionWrapper, useConfig } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  GqlIntegration,
  transformIntegration,
  INTEGRATION_SHORT_FIELDS,
} from "../../integrations/graphql";
import { IntegrationShort } from "../../integrations/types";
import {
  GqlSecret,
  transformSecret,
  SECRET_SHORT_FIELDS,
} from "../../secrets/graphql";
import { SecretShort } from "../../secrets/types";
import {
  GqlSourceCode,
  transformSourceCode,
  SOURCE_CODE_DETAIL_FIELDS,
} from "../../source_codes/graphql";
import { RefFolders, SourceCodeResponse } from "../../source_codes/types";
import {
  GqlStorage,
  STORAGE_DETAIL_FIELDS,
  transformStorage,
} from "../../storages/graphql";
import { StorageShort } from "../../storages/types";
import { IkEntity } from "../../types";
import {
  EXECUTOR_DETAIL_FIELDS,
  GqlExecutor,
  transformExecutor,
} from "../graphql";
import { ExecutorResponse, ExecutorUpdate } from "../types";

interface ReferenceOptions {
  integrations: IntegrationShort[];
  secrets: SecretShort[];
  sourceCodes: SourceCodeResponse[];
  storages: StorageShort[];
}

export const ExecutorEditPageInner = (props: {
  entity: ExecutorResponse;
  referenceOptions: ReferenceOptions;
}) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity, referenceOptions } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}executors/${entity.id}`);

  const getEntityDefaultValues = useCallback(
    (entity: ExecutorResponse): ExecutorUpdate => {
      return {
        description: entity.description,
        command_args: entity.command_args,
        integration_ids: entity.integration_ids.map((i) => i.id),
        secret_ids: entity.secret_ids.map((s) => s.id),
        source_code_folder: entity.source_code_folder || "",
        source_code_id: entity.source_code ? entity.source_code.id : "",
        source_code_branch: entity.source_code_branch || "",
        source_code_version: entity.source_code_version || "",
        labels: entity.labels,
        storage_id: entity.storage?.id || null,
        storage_path: entity.storage_path,
      };
    },
    [],
  );

  const getMergedDefaultValues = useCallback((): ExecutorUpdate => {
    const entityDefaults = getEntityDefaultValues(entity);
    return {
      ...entityDefaults,
      integration_ids: entityDefaults.integration_ids,
    };
  }, [entity, getEntityDefaultValues]);

  const methods = useForm<ExecutorUpdate>({
    mode: "onChange",
    defaultValues: getMergedDefaultValues(),
  });

  const {
    control,
    handleSubmit,
    trigger,
    setValue,
    formState: { errors, dirtyFields, isDirty },
    watch,
    reset,
  } = methods;

  useEffect(() => {
    const mergedValues = getMergedDefaultValues();
    reset(mergedValues);
  }, [getMergedDefaultValues, reset]);

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [gitTags, setGitTags] = useState<string[]>([]);
  const [gitTagMessages, setGitTagMessages] = useState<Record<string, string>>(
    {},
  );
  const [gitBranches, setGitBranches] = useState<string[]>([]);
  const [gitBranchMessages, setGitBranchMessages] = useState<
    Record<string, string>
  >({});
  const [gitFolders, setGitFolders] = useState<string[]>([]);
  const [isStorageEditable, setIsStorageEditable] = useState(false);

  const watchedVersion = watch("source_code_version");
  const watchedBranch = watch("source_code_branch");
  const watchedSourceCode = watch("source_code_id");
  const watchedIntegrationIds = watch("integration_ids");
  const watchedStorage = watch("storage_id");

  const initialIntegrationIdsRef = useRef(
    entity.integration_ids.map((i) => i.id),
  );
  const integrationsChanged = useMemo(() => {
    const initial = initialIntegrationIdsRef.current;
    return (
      JSON.stringify([...watchedIntegrationIds].sort()) !==
      JSON.stringify([...initial].sort())
    );
  }, [watchedIntegrationIds]);

  const storageOptions = useMemo(
    () => (integrationsChanged ? undefined : referenceOptions.storages),
    [integrationsChanged, referenceOptions.storages],
  );

  const filter_storage = useMemo(
    () => ({
      integration_id: watchedIntegrationIds ? watchedIntegrationIds : [],
    }),
    [watchedIntegrationIds],
  );

  useEffect(() => {
    if (watchedSourceCode) {
      if (buffer["source_codes"]) {
        const sourceCode = buffer["source_codes"].find(
          (code: IkEntity) => code.id === watchedSourceCode,
        );
        if (sourceCode) {
          setGitTags(sourceCode.git_tags || []);
          setGitBranches(sourceCode.git_branches || []);
          setGitTagMessages(sourceCode.git_tag_messages || {});
          setGitBranchMessages(sourceCode.git_branch_messages || {});
        }
      }
    }
  }, [
    watchedSourceCode,
    setGitTags,
    setGitBranches,
    buffer,
    setGitTagMessages,
    setGitBranchMessages,
  ]);

  // Clear one when the other is selected
  useEffect(() => {
    if (watchedVersion) {
      setValue("source_code_branch", undefined);
    }
  }, [watchedVersion, setValue]);

  useEffect(() => {
    if (watchedBranch) {
      setValue("source_code_version", undefined);
    }
  }, [watchedBranch, setValue]);

  useEffect(() => {
    if (watchedVersion && watchedSourceCode && buffer["source_codes"]) {
      const sourceCode = buffer["source_codes"].find(
        (code: IkEntity) => code.id === watchedSourceCode,
      );
      if (sourceCode) {
        const version = sourceCode.git_tags.find(
          (tag: string) => tag === watchedVersion,
        );
        if (version) {
          const gitFolders = sourceCode.git_folders_map.find(
            (ref: RefFolders) => ref.ref === version,
          );
          if (gitFolders) {
            setGitFolders(gitFolders.folders || []);
          }
        }
      }
    }
  }, [watchedVersion, watchedSourceCode, setGitFolders, buffer]);

  useEffect(() => {
    if (watchedBranch && watchedSourceCode && buffer["source_codes"]) {
      const sourceCode = buffer["source_codes"].find(
        (code: IkEntity) => code.id === watchedSourceCode,
      );
      if (sourceCode) {
        const branch = sourceCode.git_branches.find(
          (branch: string) => branch === watchedBranch,
        );
        if (branch) {
          const gitFolders = sourceCode.git_folders_map.find(
            (ref: RefFolders) => ref.ref === branch,
          );
          if (gitFolders) {
            setGitFolders(gitFolders.folders || []);
          }
        }
      }
    }
  }, [watchedBranch, watchedSourceCode, setGitFolders, buffer]);

  const onSubmit = useCallback(
    async (data: ExecutorUpdate) => {
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

      const changedFields: Partial<ExecutorUpdate> = {};

      (Object.keys(dirtyFields || {}) as Array<keyof ExecutorUpdate>).forEach(
        (fieldName) => {
          (changedFields as any)[fieldName] = data[fieldName];
        },
      );

      if (Object.keys(changedFields).length === 0) {
        notify("No changes detected", "info");
        return;
      }

      try {
        const response = await ikApi.updateRaw(`executors/${entity.id}`, data);
        if (response.id) {
          notify("Executor updated successfully", "success");
          navigate(`${linkPrefix}executors/${response.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [entity, trigger, isDirty, ikApi, linkPrefix, dirtyFields, navigate],
  );

  return (
    <FormProvider {...methods}>
      <PageContainer
        title="Edit Executor"
        onBack={handleBack}
        backAriaLabel="Back to executor"
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
          <PropertyCard title="Executor Definition">
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
                      : "Description of the executor"
                  }
                  fullWidth
                  margin="normal"
                />
              )}
            />
            <Controller
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput errors={errors} {...field} />}
            />
          </PropertyCard>
          <PropertyCard title="Integrations and Secrets">
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
                      : "Select Credentials for the executor"
                  }
                  value={field.value}
                  label="Credentials"
                  multiple
                  options={referenceOptions.integrations}
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
                      : "Select Secret for the executor"
                  }
                  value={field.value}
                  label="Secrets"
                  multiple
                  options={referenceOptions.secrets}
                />
              )}
            />
            <PermissionWrapper
              requiredPermission="api:storage"
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
                        options={storageOptions}
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

            <>
              <Typography variant="h5" component="h3">
                Source Code Configuration
              </Typography>
              <Box>
                <Controller
                  name="source_code_id"
                  control={control}
                  rules={{
                    required: "Source code is required",
                  }}
                  render={({ field }) => (
                    <ReferenceInput
                      {...field}
                      readOnly={true}
                      ikApi={ikApi}
                      entity_name="source_codes"
                      buffer={buffer}
                      setBuffer={setBuffer}
                      error={!!errors.source_code_id}
                      helpertext={
                        errors.source_code_id
                          ? errors.source_code_id.message
                          : ""
                      }
                      value={field.value}
                      label="Code Repository (Read Only)"
                      required
                      options={referenceOptions.sourceCodes}
                    />
                  )}
                />

                <Controller
                  name="source_code_version"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={gitTags}
                      value={field.value ?? null}
                      onChange={(_, value) =>
                        field.onChange(value ?? undefined)
                      }
                      getOptionLabel={(option) =>
                        `${option} - ${gitTagMessages[option] || ""}`
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Git Tag"
                          fullWidth
                          margin="normal"
                          error={!!errors.source_code_version}
                          helperText={
                            errors.source_code_version
                              ? errors.source_code_version.message
                              : "Select git tag"
                          }
                          inputProps={{
                            ...params.inputProps,
                            "aria-label": "Source git tag",
                          }}
                        />
                      )}
                    />
                  )}
                />
                <Controller
                  name="source_code_branch"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={gitBranches}
                      value={field.value ?? null}
                      onChange={(_, value) =>
                        field.onChange(value ?? undefined)
                      }
                      getOptionLabel={(option) =>
                        `${option} - ${gitBranchMessages[option] || ""}`
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Git Branch"
                          fullWidth
                          margin="normal"
                          error={!!errors.source_code_branch}
                          helperText={
                            errors.source_code_branch
                              ? errors.source_code_branch.message
                              : "Select git branch"
                          }
                          inputProps={{
                            ...params.inputProps,
                            "aria-label": "Source git branch",
                          }}
                        />
                      )}
                    />
                  )}
                />
                <Controller
                  name="source_code_folder"
                  control={control}
                  rules={{
                    required: "Source code folder is required",
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Directory Path"
                      fullWidth
                      margin="normal"
                      error={!!errors.source_code_folder}
                      helperText={
                        errors.source_code_folder
                          ? errors.source_code_folder.message
                          : ""
                      }
                      slotProps={{
                        select: {
                          inputProps: {
                            "aria-label": "Source directory path",
                          },
                        },
                      }}
                    >
                      {gitFolders.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />

                <Controller
                  name="command_args"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Command arguments"
                      variant="outlined"
                      error={!!errors.command_args}
                      helperText={
                        errors.command_args
                          ? errors.command_args.message
                          : "Enter command arguments (e.g., -var-file=prod.tfvars)"
                      }
                      fullWidth
                      margin="normal"
                    />
                  )}
                />
              </Box>
            </>
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const ExecutorEditPage = () => {
  const { executor_id } = useParams();

  const [entity, setEntity] = useState<ExecutorResponse>();
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptions>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getExecutor = useCallback(async (): Promise<any> => {
    try {
      const response = await ikApi.graphqlRequest<{
        executor: GqlExecutor | null;
      }>(
        `
        query Executor($id: UUID!) {
          executor(id: $id) {
            ${EXECUTOR_DETAIL_FIELDS}
          }
        }
      `,
        { id: executor_id },
      );

      if (!response.executor) {
        throw new Error("Executor not found");
      }

      const executor = transformExecutor(response.executor);
      setEntity(executor);
      setError(undefined);

      const sourceCodeId = executor.source_code?.id;
      const refResponse = await ikApi.graphqlRequest<{
        integrations: GqlIntegration[];
        secrets: GqlSecret[];
        sourceCodes: GqlSourceCode[];
        storages: GqlStorage[];
      }>(
        `
        query ExecutorEditReferenceData($scFilter: JSON, $integrationIds: [UUID!]) {
          integrations(sort: ["name", "ASC"], range: [0, 999]) {
            ${INTEGRATION_SHORT_FIELDS}
          }
          secrets(sort: ["name", "ASC"], range: [0, 999]) {
            ${SECRET_SHORT_FIELDS}
          }
          sourceCodes(filter: $scFilter, sort: ["identifier", "ASC"], range: [0, 999]) {
            ${SOURCE_CODE_DETAIL_FIELDS}
          }
          storages(filter: { integration_id: $integrationIds }, sort: ["name", "ASC"], range: [0, 999]) {
            ${STORAGE_DETAIL_FIELDS}
          }
        }
      `,
        {
          scFilter: sourceCodeId ? { id: sourceCodeId } : {},
          integrationIds: executor.integration_ids.map((i) => i.id),
        },
      );

      setReferenceOptions({
        integrations: refResponse.integrations.map(transformIntegration),
        secrets: refResponse.secrets.map(transformSecret),
        sourceCodes: refResponse.sourceCodes.map(transformSourceCode),
        storages: refResponse.storages.map(transformStorage),
      });
    } catch (e: any) {
      setError(e);
    }
  }, [ikApi, executor_id]);

  useEffectOnce(() => {
    getExecutor();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && referenceOptions && (
        <ExecutorEditPageInner
          entity={entity}
          referenceOptions={referenceOptions}
        />
      )}
    </>
  );
};
ExecutorEditPage.path = "/executors/:executor_id/edit";
