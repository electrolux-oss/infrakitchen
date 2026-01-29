import { useState, useEffect, useMemo, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button, MenuItem } from "@mui/material";

import { LabelInput } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { RefFolders } from "../../source_codes/types";
import { IkEntity } from "../../types";
import { ExecutorCreate, ExecutorResponse } from "../types";

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

  const handleBack = () => navigate(`${linkPrefix}resources`);

  const watchedSourceCode = watch("source_code_id");
  const watchedVersion = watch("source_code_version");
  const watchedBranch = watch("source_code_branch");

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
    if (watchedVersion && watchedSourceCode) {
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
    if (watchedBranch && watchedSourceCode) {
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
        .postRaw("executors", data)
        .then((response: ExecutorResponse) => {
          if (response.id) {
            notify("Executor created successfully", "success");
            navigate(`${linkPrefix}executors/${response.id}`);
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
  const watchedStorage = watch("storage_id");

  const filter_storage = useMemo(
    () => ({
      integration_id: watchedIntegrationIds ? watchedIntegrationIds : [],
    }),
    [watchedIntegrationIds],
  );

  const watchedName = watch("name");

  useEffect(() => {
    setValue(
      "storage_path",
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
              name="source_code_id"
              control={control}
              rules={{
                required: "Source code is required",
              }}
              render={({ field }) => (
                <ReferenceInput
                  {...field}
                  ikApi={ikApi}
                  entity_name="source_codes"
                  buffer={buffer}
                  setBuffer={setBuffer}
                  error={!!errors.source_code_id}
                  helpertext={
                    errors.source_code_id
                      ? errors.source_code_id.message
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
                name="source_code_version"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Select Git Tag"
                    fullWidth
                    margin="normal"
                    error={!!errors.source_code_version}
                    helperText={
                      errors.source_code_version
                        ? errors.source_code_version.message
                        : "Select git tag"
                    }
                    slotProps={{
                      select: {
                        inputProps: {
                          "aria-label": "Source git tag",
                        },
                      },
                    }}
                  >
                    {gitTags.map((type) => (
                      <MenuItem key={type} value={type}>
                        {`${type} - ${gitTagMessages[type] || ""}`}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}
            <Controller
              name="source_code_branch"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Select Git Branch"
                  fullWidth
                  margin="normal"
                  error={!!errors.source_code_branch}
                  helperText={
                    errors.source_code_branch
                      ? errors.source_code_branch.message
                      : "Select git branch"
                  }
                  slotProps={{
                    select: {
                      inputProps: {
                        "aria-label": "Source git branch",
                      },
                    },
                  }}
                >
                  {gitBranches.map((type) => (
                    <MenuItem key={type} value={type}>
                      {`${type} - ${gitBranchMessages[type] || ""}`}
                    </MenuItem>
                  ))}
                </TextField>
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
                  label="Select Directory Path"
                  fullWidth
                  margin="normal"
                  error={!!errors.source_code_folder}
                  helperText={
                    errors.source_code_folder
                      ? errors.source_code_folder.message
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
              name="command_args"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Command arguments"
                  helperText="Enter command arguments (e.g., -var-file=prod.tfvars)"
                  variant="outlined"
                  error={!!errors.command_args}
                  fullWidth
                  margin="normal"
                />
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
      runtime: "opentofu",
      command_args: "",
      labels: [],
      description: "",
      integration_ids: [],
      source_code_id: "",
      storage_id: "",
      storage_path: "",
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
