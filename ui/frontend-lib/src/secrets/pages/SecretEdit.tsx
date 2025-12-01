import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { renderFieldsForProvider } from "../components/SecretProviderForms";
import { SecretResponse, SecretUpdate } from "../types";

export const SecretEditPageInner = (props: { entity: SecretResponse }) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}secrets/${entity.id}`);

  const methods = useForm<SecretUpdate>({
    mode: "onChange",
    defaultValues: {
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
    async (data: SecretUpdate) => {
      if (!entity) return;

      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }

      if (!isDirty) {
        notify("No changes detected", "info");
        return;
      }

      const changedFields: Partial<SecretUpdate> = {};

      (Object.keys(dirtyFields) as Array<keyof SecretUpdate>).forEach(
        (fieldName) => {
          (changedFields as any)[fieldName] = data[fieldName];
        },
      );

      if (Object.keys(changedFields).length === 0) {
        notify("No changes detected", "info");
        return;
      }

      const updatePayload = {
        ...changedFields,
        secret_provider: entity.secret_provider,
      };

      try {
        const response = await ikApi.patchRaw(
          `secrets/${entity.id}`,
          updatePayload,
        );
        if (response.id) {
          notify("Secret updated successfully", "success");
          navigate(`${linkPrefix}secrets/${response.id}`);
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
        title={entity.name || "Edit Secret"}
        onBack={handleBack}
        backAriaLabel="Back to secret"
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
          <PropertyCard title="Secret Definition">
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
                      : "Description of the secret"
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
            {renderFieldsForProvider(entity.secret_provider, control, errors)}
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const SecretEditPage = () => {
  const { secret_id } = useParams();

  const [entity, setEntity] = useState<SecretResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getSecret = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`secrets/${secret_id}`)
      .then((response: SecretResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, secret_id]);

  useEffectOnce(() => {
    getSecret();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <SecretEditPageInner entity={entity} />}
    </>
  );
};
SecretEditPage.path = "/secrets/:secret_id/edit";
