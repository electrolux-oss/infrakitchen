import { useState, useEffect, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button, MenuItem } from "@mui/material";

import { LabelInput } from "../../common";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { RefFolders } from "../../source_codes/types";
import { IkEntity } from "../../types";
import { CREATE_SOURCE_CODE_VERSION_MUTATION } from "../graphql";
import { SourceCodeVersionCreate } from "../types";

const SourceCodeVersionCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    trigger,
    setValue,
    handleSubmit,
  } = useFormContext<SourceCodeVersionCreate>();
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
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}source_code_versions`);

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
    async (data: SourceCodeVersionCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }

      try {
        const response = await ikApi.graphqlRequest<{
          createSourceCodeVersion: { id: string };
        }>(CREATE_SOURCE_CODE_VERSION_MUTATION, { input: data });
        const created = response.createSourceCodeVersion;
        if (created?.id) {
          notify("Template version created successfully", "success");
          navigate(`${linkPrefix}source_code_versions/${created.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, navigate, trigger, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Template Version"
      onBack={handleBack}
      backAriaLabel="Back to template versions"
      bottomActions={
        <>
          <Button variant="outlined" color="primary" onClick={handleBack}>
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
          width: "75%",
          minWidth: 320,
          maxWidth: 1000,
        }}
      >
        <PropertyCard title="Version Definition">
          <Box>
            <Controller
              name="templateId"
              control={control}
              rules={{
                required: "Template is required",
              }}
              render={({ field }) => (
                <ReferenceInput
                  {...field}
                  ikApi={ikApi}
                  entity_name="templates"
                  buffer={buffer}
                  setBuffer={setBuffer}
                  error={!!errors.templateId}
                  helpertext={
                    errors.templateId
                      ? errors.templateId.message
                      : "Select template"
                  }
                  value={field.value}
                  label="Select Template"
                  required
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
                      : "Provide a short description"
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
              render={({ field }) => <LabelInput {...field} errors={errors} />}
            />
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
          </Box>
        </PropertyCard>

        <PropertyCard title="Configuration">
          <Box>
            <Controller
              name="sourceCodeVersion"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Select Git Tag"
                  fullWidth
                  margin="normal"
                  error={!!errors.sourceCodeVersion}
                  helperText={
                    errors.sourceCodeVersion
                      ? errors.sourceCodeVersion.message
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
            <Controller
              name="sourceCodeBranch"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Select Git Branch"
                  fullWidth
                  margin="normal"
                  error={!!errors.sourceCodeBranch}
                  helperText={
                    errors.sourceCodeBranch
                      ? errors.sourceCodeBranch.message
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
      </Box>
    </PageContainer>
  );
};

const SourceCodeVersionCreatePage = () => {
  const methods = useForm<SourceCodeVersionCreate>({
    defaultValues: {
      description: "",
      labels: [],
      sourceCodeId: "",
      sourceCodeVersion: "",
      sourceCodeBranch: "",
      sourceCodeFolder: "",
      templateId: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <SourceCodeVersionCreatePageInner />
    </FormProvider>
  );
};

SourceCodeVersionCreatePage.path = "/source_code_versions/create";

export { SourceCodeVersionCreatePage };
