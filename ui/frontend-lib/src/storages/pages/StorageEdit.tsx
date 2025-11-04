import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { StorageResponse, StorageUpdate } from "../types";

export const StorageEditPageInner = (props: { entity: StorageResponse }) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}storages/${entity.id}`);

  const methods = useForm<StorageUpdate>({
    mode: "onChange",
    defaultValues: {
      description: entity.description,
      labels: entity.labels,
    },
  });

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors, dirtyFields, isDirty },
  } = methods;

  const onSubmit = useCallback(
    async (data: StorageUpdate) => {
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

      const changedFields: Partial<StorageUpdate> = {};

      (Object.keys(dirtyFields) as Array<keyof StorageUpdate>).forEach(
        (fieldName) => {
          (changedFields as any)[fieldName] = data[fieldName];
        },
      );

      if (Object.keys(changedFields).length === 0) {
        notify("No changes detected", "info");
        return;
      }

      try {
        const response = await ikApi.patchRaw(
          `storages/${entity.id}`,
          changedFields,
        );
        if (response.id) {
          notify("Storage updated successfully", "success");
          navigate(`${linkPrefix}storages/${response.id}`);
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
        title={entity.name || "Edit Storage"}
        onBack={handleBack}
        backAriaLabel="Back to storage"
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
          <PropertyCard title="Storage Definition">
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
                      : "Description of the storage"
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
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const StorageEditPage = () => {
  const { storage_id } = useParams();

  const [entity, setEntity] = useState<StorageResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getStorage = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`storages/${storage_id}`)
      .then((response: StorageResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, storage_id]);

  useEffectOnce(() => {
    getStorage();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <StorageEditPageInner entity={entity} />}
    </>
  );
};
StorageEditPage.path = "/storages/:storage_id/edit";
