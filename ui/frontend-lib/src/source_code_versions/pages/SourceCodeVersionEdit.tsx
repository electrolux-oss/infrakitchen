import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { SourceCodeVersionResponse, SourceCodeVersionUpdate } from "../types";

export const SourceCodeVersionEditPageInner = (props: {
  entity: SourceCodeVersionResponse;
}) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () =>
    navigate(`${linkPrefix}source_code_versions/${entity.id}`);

  const methods = useForm<SourceCodeVersionUpdate>({
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
    async (data: SourceCodeVersionUpdate) => {
      if (!entity) return;

      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Please fill in all required fields"));
        return;
      }

      if (!isDirty) {
        notify("No changes detected", "info");
        return;
      }

      const changedFields: Partial<SourceCodeVersionUpdate> = {};

      (
        Object.keys(dirtyFields) as Array<keyof SourceCodeVersionUpdate>
      ).forEach((fieldName) => {
        (changedFields as any)[fieldName] = data[fieldName];
      });

      if (Object.keys(changedFields).length === 0) {
        notify("No changes detected", "info");
        return;
      }

      try {
        const response = await ikApi.patchRaw(
          `source_code_versions/${entity.id}`,
          changedFields,
        );
        if (response.id) {
          notify("SourceCodeVersion updated successfully", "success");
          navigate(`${linkPrefix}source_code_versions/${response.id}`);
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
        title={entity.identifier || "Edit Source Code Version"}
        onBack={handleBack}
        backAriaLabel="Back to source code version"
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
          <PropertyCard title="Version Definition">
            <Controller
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput {...field} errors={errors} />}
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
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const SourceCodeVersionEditPage = () => {
  const { source_code_version_id } = useParams();

  const [entity, setEntity] = useState<SourceCodeVersionResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getSourceCodeVersion = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`source_code_versions/${source_code_version_id}`)
      .then((response: SourceCodeVersionResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, source_code_version_id]);

  useEffectOnce(() => {
    getSourceCodeVersion();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <SourceCodeVersionEditPageInner entity={entity} />}
    </>
  );
};
SourceCodeVersionEditPage.path =
  "/source_code_versions/:source_code_version_id/edit";
