import { useState, useCallback } from "react";

import { Controller, useForm, FormProvider } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import {
  Button,
  Box,
  TextField,
  Alert,
  Autocomplete,
  Chip,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import { useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { renderFieldsForProvider } from "../components/AuthProviderForms";
import { AuthProviderResponse, AuthProviderUpdate } from "../types";

export const AuthProviderEditPageInner = (props: {
  entity: AuthProviderResponse;
}) => {
  const { entity } = props;
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}auth_providers/${entity.id}`);

  const methods = useForm<AuthProviderUpdate>({
    mode: "onChange",
    defaultValues: {
      name: entity.name,
      description: entity.description,
      enabled: entity.enabled,
      filter_by_domain: entity.filter_by_domain,
      configuration: entity.configuration,
    },
  });

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = methods;

  const onSubmit = useCallback(
    async (data: AuthProviderUpdate) => {
      if (!entity) return;

      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Please fill in all required fields"));
        return;
      }
      const updatedData = {
        ...data,
        configuration: {
          ...data.configuration,
          auth_provider: entity.auth_provider,
        },
      };

      try {
        const response = await ikApi.patchRaw(
          `auth_providers/${entity.id}`,
          updatedData,
        );
        if (response.id) {
          notify("Auth Provider updated successfully", "success");
          navigate(`${linkPrefix}auth_providers/${response.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [entity, trigger, ikApi, linkPrefix, navigate],
  );

  return (
    <FormProvider {...methods}>
      <PageContainer
        title="Edit Auth Provider"
        onBack={handleBack}
        backAriaLabel="Back to auth providers"
        bottomActions={
          <>
            <Button variant="outlined" onClick={handleBack}>
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
          <PropertyCard title="Auth Provider Definition">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  variant="outlined"
                  error={!!errors.name}
                  helperText={
                    errors.name
                      ? errors.name.message
                      : "Name of the auth provider"
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
                      : "Description of the auth provider"
                  }
                  fullWidth
                  margin="normal"
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
                  renderTags={(value: readonly string[], getTagProps) =>
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
                      label="Filter by Domain"
                      variant="outlined"
                      error={!!errors.filter_by_domain}
                      helperText={
                        errors.filter_by_domain
                          ? errors.filter_by_domain.message
                          : "Add domains and press Enter"
                      }
                      fullWidth
                      margin="normal"
                    />
                  )}
                />
              )}
            />
          </PropertyCard>
          <PropertyCard title="Configuration">
            {renderFieldsForProvider(entity.auth_provider, control, errors)}
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const AuthProviderEditPage = () => {
  const { auth_provider_id } = useParams();
  const [entity, setEntity] = useState<AuthProviderResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getAuthProvider = useCallback(async (): Promise<void> => {
    await ikApi
      .get(`auth_providers/${auth_provider_id}`)
      .then((response: AuthProviderResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, auth_provider_id]);

  useEffectOnce(() => {
    getAuthProvider();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <AuthProviderEditPageInner entity={entity} />}
    </>
  );
};

AuthProviderEditPage.path = "/auth_providers/:auth_provider_id/edit";
