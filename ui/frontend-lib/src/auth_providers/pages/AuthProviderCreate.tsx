import { useState, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import {
  Box,
  TextField,
  Button,
  Autocomplete,
  Chip,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { renderFieldsForProvider } from "../components/AuthProviderForms";
import { AuthProviderCreate } from "../types";
import { AuthProviderResponse } from "../types";

const auth_providers = [
  "microsoft",
  "guest",
  "github",
  "backstage",
  "ik_service_account",
];

const AuthProviderCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    trigger,
    handleSubmit,
  } = useFormContext<AuthProviderCreate>();

  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}auth_providers`);

  const selectedProvider = watch("auth_provider");

  const handleSave = useCallback(
    async (data: AuthProviderCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }
      const updatedData = {
        ...data,
        configuration: {
          ...data.configuration,
          auth_provider: data.auth_provider,
        },
      };

      ikApi
        .postRaw("auth_providers", updatedData)
        .then((response: AuthProviderResponse) => {
          if (response.id) {
            notify("AuthProvider created successfully", "success");
            navigate(`${linkPrefix}auth_providers/${response.id}`);
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

  return (
    <PageContainer
      title="Create AuthProvider"
      onBack={handleBack}
      backAriaLabel="Back to auth_providers"
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
        <PropertyCard title="AuthProvider Definition">
          <Box>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  variant="outlined"
                  error={!!errors.name}
                  helperText={
                    errors.name ? errors.name.message : "Provide a unique name"
                  }
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
                      : "Provide a short description"
                  }
                  fullWidth
                  margin="normal"
                />
              )}
            />
            <Controller
              name="auth_provider"
              control={control}
              rules={{ required: "Auth provider is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Auth Provider"
                  variant="outlined"
                  error={!!errors.auth_provider}
                  helperText={
                    errors.auth_provider
                      ? errors.auth_provider.message
                      : "Select the auth provider"
                  }
                  fullWidth
                  margin="normal"
                >
                  {auth_providers.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="filter_by_domain"
              control={control}
              defaultValue={[]}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={field.value}
                  onChange={(_event, newValue) => field.onChange(newValue)}
                  renderValue={(value: readonly string[], getTagProps) =>
                    value.map((option: string, index: number) => {
                      const { key, ...rest } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          {...rest}
                          variant="outlined"
                          label={option}
                        />
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Filter By Domain"
                      variant="outlined"
                      error={!!errors.filter_by_domain}
                      helperText={
                        errors.filter_by_domain
                          ? errors.filter_by_domain.message
                          : "Add filter by domain and press Enter"
                      }
                      fullWidth
                      margin="normal"
                    />
                  )}
                />
              )}
            />
            <Controller
              name="enabled"
              control={control}
              defaultValue={false}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label="Enabled"
                />
              )}
            />
          </Box>
        </PropertyCard>
        {selectedProvider && (
          <PropertyCard title="Configuration">
            <Box>
              {renderFieldsForProvider(selectedProvider, control, errors)}
            </Box>
          </PropertyCard>
        )}
      </Box>
    </PageContainer>
  );
};

export const AuthProviderCreatePage = () => {
  const methods = useForm<AuthProviderCreate>({
    defaultValues: {
      name: "",
      description: "",
      auth_provider: "",
      configuration: {},
      filter_by_domain: [],
      enabled: true,
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <AuthProviderCreatePageInner />
    </FormProvider>
  );
};

AuthProviderCreatePage.path = "/auth_providers/create";
