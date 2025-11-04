import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { renderFieldsForProvider } from "../components/IntegrationProviderForms";
import { IntegrationResponse, IntegrationUpdate } from "../types";

export const IntegrationEditPageInner = (props: {
  entity: IntegrationResponse;
}) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () =>
    navigate(
      `${linkPrefix}integrations/${entity.integration_type}/${entity.id}`,
    );

  const methods = useForm<IntegrationUpdate>({
    mode: "onChange",
    defaultValues: {
      name: entity.name,
      description: entity.description,
      labels: entity.labels,
      configuration: entity.configuration,
    },
  });

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors, dirtyFields, isDirty },
  } = methods;

  const onSubmit = useCallback(
    async (data: IntegrationUpdate) => {
      if (!entity) return;

      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Please fill in all required fields."));
        return;
      }

      if (!isDirty) {
        notify("No changes detected", "info");
        return;
      }

      const changedFields: Partial<IntegrationUpdate> = {};

      (Object.keys(dirtyFields) as Array<keyof IntegrationUpdate>).forEach(
        (fieldName) => {
          (changedFields as any)[fieldName] = data[fieldName];
        },
      );

      if (Object.keys(changedFields).length === 0) {
        notify("No changes detected", "info");
        return;
      }

      try {
        const updatedData = {
          ...data,
          configuration: {
            ...data.configuration,
            integration_provider: entity.integration_provider,
          },
        };

        const response = await ikApi.patchRaw(
          `integrations/${entity.id}`,
          updatedData,
        );

        if (response.id) {
          notify("Integration updated successfully", "success");
          navigate(
            `${linkPrefix}integrations/${response.integration_type}/${response.id}`,
          );
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
        title="Edit Integration"
        onBack={handleBack}
        backAriaLabel="Back to integration"
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
          <PropertyCard title="Integration Definition">
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  required
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
          </PropertyCard>

          <PropertyCard title="Configuration">
            {renderFieldsForProvider(
              entity.integration_provider,
              control,
              errors,
            )}
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const IntegrationEditPage = () => {
  const { integration_id } = useParams();
  const [entity, setEntity] = useState<IntegrationResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getIntegration = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`integrations/${integration_id}`)
      .then((response) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, integration_id]);

  useEffectOnce(() => {
    getIntegration();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <IntegrationEditPageInner entity={entity} />}
    </>
  );
};
IntegrationEditPage.path = "/integrations/:integration_id/edit";
