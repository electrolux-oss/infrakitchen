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
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import { SourceCodeCreate, SourceCodeResponse } from "../types";

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

  const watched_source_code_provider = watch("source_code_provider");
  const navigate = useNavigate();

  const handleSave = useCallback(
    async (data: any) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }

      ikApi
        .postRaw("source_codes", data)
        .then((response: SourceCodeResponse) => {
          if (response.id) {
            navigate(`${linkPrefix}source_codes/${response.id}`);
            return response;
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi, linkPrefix, trigger, navigate],
  );

  const handleBack = () => navigate(`${linkPrefix}source_codes`);

  return (
    <PageContainer
      title="Import Source Code Repository"
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
        <PropertyCard title="Repository Definition">
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
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput {...field} errors={errors} />}
            />
            <Controller
              name="source_code_url"
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
                  label="Source Code URL"
                  variant="outlined"
                  error={!!errors.source_code_url}
                  helperText={
                    errors.source_code_url
                      ? errors.source_code_url.message
                      : "URL of the source code"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Source code URL",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="source_code_provider"
              control={control}
              rules={{
                required: "Source code provider is required",
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Source Code Provider"
                  fullWidth
                  margin="normal"
                  error={!!errors.source_code_provider}
                  helperText={errors.source_code_provider?.message}
                  slotProps={{
                    select: {
                      inputProps: {
                        "aria-label": "Source code provider",
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
              name="source_code_language"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Source Code Language"
                  fullWidth
                  disabled
                  margin="normal"
                  error={!!errors.source_code_language}
                  helperText={errors.source_code_language?.message}
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
            {watched_source_code_provider && (
              <Controller
                name="integration_id"
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
                        watched_source_code_provider,
                        `${watched_source_code_provider}_ssh`,
                      ],
                    }}
                    error={!!errors.integration_id}
                    helpertext={
                      errors.integration_id
                        ? errors.integration_id.message
                        : "Select credentials for the source code"
                    }
                    value={field.value}
                    label="Select Credentials"
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

export const SourceCodeCreatePage = () => {
  const methods = useForm<SourceCodeCreate>({
    defaultValues: {
      description: "",
      source_code_url: "",
      source_code_provider: "",
      source_code_language: "opentofu",
      integration_id: null,
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
