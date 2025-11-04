import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { WorkspaceResponse, WorkspaceUpdate } from "../types";

export const WorkspaceEditPageInner = (props: {
  entity: WorkspaceResponse;
}) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}workspaces/${entity.id}`);

  const methods = useForm<WorkspaceUpdate>({
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
    async (data: WorkspaceUpdate) => {
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

      const changedFields: Partial<WorkspaceUpdate> = {};

      (Object.keys(dirtyFields) as Array<keyof WorkspaceUpdate>).forEach(
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
          `workspaces/${entity.id}`,
          changedFields,
        );
        if (response.id) {
          notify("Workspace updated successfully", "success");
          navigate(`${linkPrefix}workspaces/${response.id}`);
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
        title="Edit Workspace"
        onBack={handleBack}
        backAriaLabel="Back to workspace"
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
          <PropertyCard title="Workspace Definition">
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
                      : "Description of the workspace"
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

export const WorkspaceEditPage = () => {
  const { workspace_id } = useParams();

  const [entity, setEntity] = useState<WorkspaceResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getWorkspace = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`workspaces/${workspace_id}`)
      .then((response: WorkspaceResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, workspace_id]);

  useEffectOnce(() => {
    getWorkspace();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <WorkspaceEditPageInner entity={entity} />}
    </>
  );
};
WorkspaceEditPage.path = "/workspaces/:workspace_id/edit";
