import { useState, useEffect, useMemo, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button, MenuItem, Autocomplete } from "@mui/material";

import { LabelInput } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { RefFolders } from "../../source_codes/types";
import { IkEntity } from "../../types";
import { EXECUTOR_CREATE_MUTATION } from "../graphql";
import { ExecutorCreate } from "../types";

const ExecutorCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    trigger,
    setValue,
    handleSubmit,
  } = useFormContext<ExecutorCreate>();

  const [saving, setSaving] = useState(false);
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

  const navigate = useNavigate();

  const handleBack = () => navigate(`${linkPrefix}executors`);

  const watchedSourceCode = watch("sourceCodeId");
  const watchedVersion = watch("sourceCodeVersion");
  const watchedBranch = watch("sourceCodeBranch");

  useEffect(() => {
    if (watchedSourceCode) {
      if (buffer["source_codes"]) {
        const sourceCode = buffer["source_codes"].find(
          (code: IkEntity) => code.id === watchedSourceCode,
        );
        if (sourceCode) {
          setGitTags(sourceCode.gitTags || []);
          setGitBranches(sourceCode.gitBranches || []);
          setGitTagMessages(sourceCode.gitTagMessages || {});
          setGitBranchMessages(sourceCode.gitBranchMessages || {});
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
      setValue("sourceCodeBranch", undefined);
    }
  }, [watchedVersion, setValue]);

  useEffect(() => {
    if (watchedBranch) {
      setValue("sourceCodeVersion", undefined);
    }
  }, [watchedBranch, setValue]);

  useEffect(() => {
    if (watchedVersion && watchedSourceCode) {
      const sourceCode = buffer["source_codes"].find(
        (code: IkEntity) => code.id === watchedSourceCode,
      );
      if (sourceCode) {
        const version = sourceCode.gitTags.find(
          (tag: string) => tag === watchedVersion,
        );
        if (version) {
          const gitFolders = sourceCode.gitFoldersMap.find(
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
    if (watchedBranch && watchedSourceCode) {
      const sourceCode = buffer["source_codes"].find(
        (code: IkEntity) => code.id === watchedSourceCode,
      );
      if (sourceCode) {
        const branch = sourceCode.gitBranches.find(
          (branch: string) => branch === watchedBranch,
        );
        if (branch) {
          const gitFolders = sourceCode.gitFoldersMap.find(
            (ref: RefFolders) => ref.ref === branch,
          );
          if (gitFolders) {
            setGitFolders(gitFolders.folders || []);
          }
        }
      }
    }
  }, [watchedBranch, watchedSourceCode, setGitFolders, buffer]);

  const handleSave = useCallback(
    async (data: ExecutorCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }
      ikApi
        .graphqlRequest<{ createExecutor: { id: string; name: string } }>(
          EXECUTOR_CREATE_MUTATION,
          { input: data },
        )
        .then((response) => {
          const created = response.createExecutor;
          if (created?.id) {
            notify("Executor created successfully", "success");
            navigate(`${linkPrefix}executors/${created.id}`);
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

  const watchedIntegrationIds = watch("integrationIds");
  const watchedStorage = watch("storageId");

  const filter_storage = useMemo(
    () => ({
      integration_id: watchedIntegrationIds ? watchedIntegrationIds : [],
    }),
    [watchedIntegrationIds],
  );

  const watchedName = watch("name");

  useEffect(() => {
    setValue(
      "storagePath",
      `service-catalog/executor/${watchedName}/terraform.tfstate`.replaceAll(
        " ",
        "_",
      ),
    );
  }, [watchedName, setValue]);

  return (
    <PageContainer
      title="Create Executor"
      onBack={handleBack}
      backAriaLabel="Back to executors list"
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
        <PropertyCard title="Executor Definition">
          <Box>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  required
                  placeholder="Enter executor name. It should be unique within the selected template."
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
                  placeholder="Enter executor description (optional)"
                  variant="outlined"
                  error={!!errors.description}
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
          </Box>
        </PropertyCard>
        <PropertyCard title="Code Repo Configuration">
          <Box>
            <Controller
              name="sourceCodeId"
              control={control}
              rules={{
                required: "Source code is required",
              }}
              render={({ field }) => (
                <ReferenceInput
                  {...field}
                  ikApi={ikApi}
                  entity_name="source_codes"
                  fields={[
                    "identifier",
                    "gitTags",
                    "gitBranches",
                    "gitFoldersMap",
                    "gitTagMessages",
                    "gitBranchMessages",
                  ]}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  error={!!errors.sourceCodeId}
                  helpertext={
                    errors.sourceCodeId
                      ? errors.sourceCodeId.message
                      : "Select code repository"
                  }
                  value={field.value}
                  label="Select Code Repository"
                  required
                />
              )}
            />

            {gitTags.length > 0 && (
              <Controller
                name="sourceCodeVersion"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={gitTags}
                    value={field.value ?? null}
                    onChange={(_, value) => field.onChange(value ?? undefined)}
                    getOptionLabel={(option) =>
                      `${option} - ${gitTagMessages[option] || ""}`
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Git Tag"
                        fullWidth
                        margin="normal"
                        error={!!errors.sourceCodeVersion}
                        helperText={
                          errors.sourceCodeVersion
                            ? errors.sourceCodeVersion.message
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
            )}
            <Controller
              name="sourceCodeBranch"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={gitBranches}
                  value={field.value ?? null}
                  onChange={(_, value) => field.onChange(value ?? undefined)}
                  getOptionLabel={(option) =>
                    `${option} - ${gitBranchMessages[option] || ""}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Git Branch"
                      fullWidth
                      margin="normal"
                      error={!!errors.sourceCodeBranch}
                      helperText={
                        errors.sourceCodeBranch
                          ? errors.sourceCodeBranch.message
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
              name="sourceCodeFolder"
              control={control}
              rules={{
                required: "Source code folder is required",
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Select Directory Path"
                  fullWidth
                  margin="normal"
                  error={!!errors.sourceCodeFolder}
                  helperText={
                    errors.sourceCodeFolder
                      ? errors.sourceCodeFolder.message
                      : "Select directory path"
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
          </Box>
        </PropertyCard>

        <PropertyCard title="Executor Configuration">
          <Box>
            <Controller
              name="commandArgs"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Command arguments"
                  helperText="Enter command arguments (e.g., -var-file=prod.tfvars)"
                  variant="outlined"
                  error={!!errors.commandArgs}
                  fullWidth
                  margin="normal"
                />
              )}
            />
            <Controller
              name="integrationIds"
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
                  error={!!errors.integrationIds}
                  helpertext={
                    errors.integrationIds
                      ? (errors.integrationIds as any).message
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
              name="secretIds"
              control={control}
              render={({ field }) => (
                <ArrayReferenceInput
                  {...field}
                  ikApi={ikApi}
                  entity_name="secrets"
                  showFields={["name", "secret_provider"]}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  error={!!errors.secretIds}
                  helpertext={
                    errors.secretIds
                      ? (errors.secretIds as any).message
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
                name="storageId"
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
            )}

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
                        : "By default InfraKitchen uses `service-catalog/{template}/{executor_name}/terraform.tfstate` as the path. You can specify another path if needed (e.g., for migration), but note that this is a frozen field that you can not update later on. If you edit this field, make sure the path is unique within the selected storage."
                    }
                  />
                )}
              />
            )}
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

const ExecutorCreatePage = () => {
  const methods = useForm<ExecutorCreate>({
    defaultValues: {
      name: "",
      runtime: "tofu",
      commandArgs: "",
      labels: [],
      description: "",
      integrationIds: [],
      sourceCodeId: "",
      storageId: "",
      storagePath: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <ExecutorCreatePageInner />
    </FormProvider>
  );
};

ExecutorCreatePage.path = "/executors/create";

export { ExecutorCreatePage };
