import { useCallback, useEffect, useState } from "react";

import { Control, FormProvider, useForm } from "react-hook-form";

import { Box, Button, Grid } from "@mui/material";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { GqlWorkerTemplate, UPDATE_WORKER_TEMPLATE_MUTATION } from "../graphql";
import { WORKER_PROVIDER_FORMS } from "../providers";

interface WorkerTemplateConfigurationProps {
  workerTemplate: GqlWorkerTemplate;
}

export const WorkerTemplateConfiguration = ({
  workerTemplate,
}: WorkerTemplateConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity, actions } = useEntityProvider();
  const canEdit = actions.includes("edit");
  const [saving, setSaving] = useState(false);

  const methods = useForm<{ configuration: Record<string, any> }>({
    mode: "onChange",
    defaultValues: { configuration: workerTemplate.configuration || {} },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = methods;

  useEffect(() => {
    reset({ configuration: workerTemplate.configuration || {} });
  }, [workerTemplate.configuration, reset]);

  const save = useCallback(
    async (data: { configuration: Record<string, any> }) => {
      setSaving(true);
      try {
        await ikApi.graphqlRequest(UPDATE_WORKER_TEMPLATE_MUTATION, {
          id: workerTemplate.id,
          input: {
            configuration: {
              ...data.configuration,
              provider: workerTemplate.provider,
            },
          },
        });
        notify("Worker template configuration updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, workerTemplate.id, workerTemplate.provider, refreshEntity],
  );

  const ConfigForm = WORKER_PROVIDER_FORMS[workerTemplate.provider]?.ConfigForm;
  if (!ConfigForm) return null;

  return (
    <BaseCard name="Worker Configuration">
      <Grid size={12}>
        <FormProvider {...methods}>
          <ConfigForm
            control={control as Control<any>}
            errors={errors}
            readOnly={!canEdit}
          />
          {canEdit && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button
                onClick={() =>
                  reset({ configuration: workerTemplate.configuration || {} })
                }
                disabled={!isDirty || saving}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit(save)}
                disabled={!isDirty}
                loading={saving}
              >
                Save
              </Button>
            </Box>
          )}
        </FormProvider>
      </Grid>
    </BaseCard>
  );
};
