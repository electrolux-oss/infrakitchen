import { useState, useCallback } from "react";

import {
  Control,
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
import { CREATE_AUTH_PROVIDER_MUTATION } from "../graphql";
import { AuthProviderCreate } from "../types";

const authProviders = [
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

  const selectedProvider = watch("authProvider");

  const handleSave = useCallback(
    async (data: AuthProviderCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }
      const input = {
        ...data,
        configuration: {
          ...data.configuration,
          auth_provider: data.authProvider,
        },
      };

      try {
        const response = await ikApi.graphqlRequest<{
          createAuthProvider: { id: string };
        }>(CREATE_AUTH_PROVIDER_MUTATION, { input });
        const created = response.createAuthProvider;
        if (created?.id) {
          notify("AuthProvider created successfully", "success");
          navigate(`${linkPrefix}auth_providers/${created.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, navigate, trigger, setSaving, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Auth Provider"
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
        <PropertyCard title="Auth Provider Definition">
          <Box>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  required={true}
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
              name="authProvider"
              control={control}
              rules={{ required: "Auth provider is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Auth Provider"
                  required={true}
                  variant="outlined"
                  error={!!errors.authProvider}
                  helperText={
                    errors.authProvider
                      ? errors.authProvider.message
                      : "Select the auth provider"
                  }
                  fullWidth
                  margin="normal"
                >
                  {authProviders.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="filterByDomain"
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
                      error={!!errors.filterByDomain}
                      helperText={
                        errors.filterByDomain
                          ? errors.filterByDomain.message
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
              {renderFieldsForProvider(
                selectedProvider,
                control as Control<any>,
                errors,
              )}
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
      authProvider: "",
      configuration: {},
      filterByDomain: [],
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
