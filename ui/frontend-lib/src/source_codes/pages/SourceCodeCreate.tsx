import { useState, useCallback } from "react";

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
import { IkEntity } from "../../types";
import { CREATE_SOURCE_CODE_MUTATION } from "../graphql";
import { SourceCodeCreate } from "../types";

const SOURCE_CODE_LANGUAGES = ["opentofu"];

const SourceCodeCreatePageInner = () => {
  const { ikApi, linkPrefix, globalConfig } = useConfig();
  const {
    control,
    formState: { errors },
    trigger,
    watch,
    handleSubmit,
  } = useFormContext<SourceCodeCreate>();

  const [saving, setSaving] = useState(false);
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const watchedSourceCodeProvider = watch("sourceCodeProvider");
  const navigate = useNavigate();

  const handleSave = useCallback(
    async (data: SourceCodeCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }

      try {
        const response = await ikApi.graphqlRequest<{
          createSourceCode: { id: string };
        }>(CREATE_SOURCE_CODE_MUTATION, { input: data });
        const createdSourceCode = response.createSourceCode;
        if (createdSourceCode?.id) {
          notify("Code repository imported successfully", "success");
          navigate(`${linkPrefix}source_codes/${createdSourceCode.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, linkPrefix, trigger, navigate],
  );

  const handleBack = () => navigate(`${linkPrefix}source_codes`);

  return (
    <PageContainer
      title="Import Code Repository"
      onBack={handleBack}
      backAriaLabel="Back to previous page"
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
            {saving ? "Importing..." : "Import"}
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
        <PropertyCard title="Repository Details">
          <Box>
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
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Source code description",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="sourceCodeUrl"
              control={control}
              rules={{
                required: "Source code URL is required",
                pattern: {
                  value: /^(https?:\/\/.+|[\w.-]+@[\w.-]+:[\w./-]+)$/,
                  message: "Https or Git URL is required",
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Repository URL"
                  required
                  variant="outlined"
                  error={!!errors.sourceCodeUrl}
                  helperText={
                    errors.sourceCodeUrl
                      ? errors.sourceCodeUrl.message
                      : "The URL of the repository, e.g., https://github.com/user/repo"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Repository URL",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="sourceCodeProvider"
              control={control}
              rules={{
                required: "Repository provider is required",
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Repository Provider"
                  required
                  fullWidth
                  margin="normal"
                  error={!!errors.sourceCodeProvider}
                  helperText={errors.sourceCodeProvider?.message}
                  slotProps={{
                    select: {
                      inputProps: {
                        "aria-label": "Repository provider",
                      },
                    },
                  }}
                >
                  {globalConfig?.git_provider_registry?.map((type: string) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="sourceCodeLanguage"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Source Code Language"
                  fullWidth
                  disabled
                  margin="normal"
                  error={!!errors.sourceCodeLanguage}
                  helperText={errors.sourceCodeLanguage?.message}
                  slotProps={{
                    select: {
                      inputProps: {
                        "aria-label": "Source code language",
                      },
                    },
                  }}
                >
                  {SOURCE_CODE_LANGUAGES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            {watchedSourceCodeProvider && (
              <Controller
                name="integrationId"
                control={control}
                render={({ field }) => (
                  <ReferenceInput
                    ikApi={ikApi}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    {...field}
                    entity_name="integrations"
                    filter={{
                      integration_type: "git",
                      integration_provider: [
                        watchedSourceCodeProvider,
                        `${watchedSourceCodeProvider}_ssh`,
                      ],
                    }}
                    error={!!errors.integrationId}
                    helpertext={
                      errors.integrationId
                        ? errors.integrationId.message
                        : "Select integration for the repository"
                    }
                    value={field.value}
                    label="Select Integration"
                  />
                )}
              />
            )}
            <Controller
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput {...field} errors={errors} />}
            />
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

export const SourceCodeCreatePage = () => {
  const methods = useForm<SourceCodeCreate>({
    defaultValues: {
      description: "",
      sourceCodeUrl: "",
      sourceCodeProvider: "",
      sourceCodeLanguage: "opentofu",
      integrationId: null,
      labels: [],
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <SourceCodeCreatePageInner />
    </FormProvider>
  );
};

SourceCodeCreatePage.path = "/source_codes/create";
