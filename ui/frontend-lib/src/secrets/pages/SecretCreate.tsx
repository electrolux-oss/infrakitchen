import { useState, useCallback } from "react";

import {
  Control,
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
import { renderFieldsForProvider } from "../components/SecretProviderForms";
import {
  CREATE_SECRET_MUTATION,
  VALIDATE_SECRET_CONFIG_MUTATION,
} from "../graphql";
import { SecretCreate, SecretValidationResult } from "../types";

const secretProviderMapping: Record<string, string> = {
  custom: "IK Custom Secret",
  aws: "AWS Secret Manager",
  gcp: "GCP Secret Manager",
};

const secretTypes = ["tofu"];

const SecretCreatePageInner = () => {
  const { ikApi, linkPrefix, globalConfig } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    trigger,
    handleSubmit,
  } = useFormContext<SecretCreate>();

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const selectedProvider = watch("secretProvider");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}secrets`);

  const handleValidation = useCallback(
    async (data: SecretCreate) => {
      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Fix validation errors before testing."));
        return;
      }
      const input = {
        name: data.name,
        description: data.description,
        secretType: data.secretType,
        secretProvider: data.secretProvider,
        integrationId: data.integrationId,
        labels: data.labels,
        configuration: {
          ...data.configuration,
          secret_provider: data.secretProvider,
        },
      };

      try {
        const response = await ikApi.graphqlRequest<{
          validateSecretConfig: SecretValidationResult;
        }>(VALIDATE_SECRET_CONFIG_MUTATION, { input });

        const result = response.validateSecretConfig;
        if (result.isValid) {
          notify(result.message, "success");
        } else {
          notifyError(
            new Error(
              `Validation failed: ${result.message || "No message provided."}`,
            ),
          );
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, trigger],
  );

  const handleSave = useCallback(
    async (data: SecretCreate) => {
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
          secret_provider: data.secretProvider,
        },
        integrationId: data.integrationId || null, // Ensure we send null if no integration is selected
      };

      try {
        const response = await ikApi.graphqlRequest<{
          createSecret: { id: string };
        }>(CREATE_SECRET_MUTATION, { input });
        const createdSecret = response.createSecret;
        if (createdSecret?.id) {
          notify("Secret created successfully", "success");
          navigate(`${linkPrefix}secrets/${createdSecret.id}`);
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
      title="Create Secret"
      onBack={handleBack}
      backAriaLabel="Back to secrets"
      bottomActions={
        <>
          <Button variant="outlined" onClick={handleSubmit(handleValidation)}>
            Test Connection
          </Button>
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
        <PropertyCard title="Secret Definition">
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
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput {...field} errors={errors} />}
            />
            <Controller
              name="secretProvider"
              control={control}
              rules={{ required: "Secret provider is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Secret Provider"
                  variant="outlined"
                  error={!!errors.secretProvider}
                  helperText={
                    errors.secretProvider
                      ? errors.secretProvider.message
                      : "Select the secret provider"
                  }
                  fullWidth
                  margin="normal"
                >
                  {globalConfig?.secret_provider_registry?.map(
                    (option: string) => (
                      <MenuItem key={option} value={option}>
                        {secretProviderMapping[option] || option}
                      </MenuItem>
                    ),
                  )}
                </TextField>
              )}
            />

            {selectedProvider != "custom" && (
              <Controller
                name="integrationId"
                control={control}
                rules={{ required: "Integration is required" }}
                render={({ field }) => (
                  <ReferenceInput
                    disabled={!selectedProvider}
                    ikApi={ikApi}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    {...field}
                    entity_name="integrations"
                    filter={{
                      integration_type: "cloud",
                      integration_provider: selectedProvider,
                    }}
                    error={!!errors.integrationId}
                    helpertext={
                      errors.integrationId
                        ? errors.integrationId.message
                        : "Select credentials for the secret"
                    }
                    value={field.value}
                    label="Select Integration"
                    required
                  />
                )}
              />
            )}
            <Controller
              name="secretType"
              control={control}
              rules={{ required: "Secret type is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  disabled
                  label="Secret Type"
                  variant="outlined"
                  error={!!errors.secretType}
                  helperText={
                    errors.secretType
                      ? errors.secretType.message
                      : "Select the secret type"
                  }
                  fullWidth
                  margin="normal"
                >
                  {secretTypes.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>
        </PropertyCard>

        {selectedProvider && (
          <PropertyCard
            title={`Configuration for ${secretProviderMapping[selectedProvider] || ""}`}
          >
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

const SecretCreatePage = () => {
  const methods = useForm<SecretCreate>({
    defaultValues: {
      name: "",
      description: "",
      integrationId: "",
      labels: [],
      secretType: "tofu",
      secretProvider: "",
      configuration: {},
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <SecretCreatePageInner />
    </FormProvider>
  );
};

SecretCreatePage.path = "/secrets/create";

export { SecretCreatePage };
