import { useCallback, useEffect, useState } from "react";

import { Control, Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, Button, MenuItem, TextField } from "@mui/material";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  CREATE_WORKER_TEMPLATE_MUTATION,
  WORKER_PROVIDERS_QUERY,
  WORKER_TEMPLATE_DEFAULT_CONFIGURATION_QUERY,
} from "../graphql";
import { WORKER_PROVIDER_FORMS, getWorkerProviderLabel } from "../providers";
import { WorkerTemplateCreate } from "../types";

const toInt = (value: string) => (value === "" ? ("" as any) : Number(value));

export const WorkerTemplateCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  const methods = useForm<WorkerTemplateCreate>({
    defaultValues: {
      name: "",
      description: "",
      provider: "",
      configuration: {},
      maxWorkers: 3,
      idleTimeoutSeconds: 300,
      priority: 0,
      labels: [],
    },
    mode: "onChange",
  });
  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
    watch,
  } = methods;
  const provider = watch("provider");

  useEffect(() => {
    ikApi
      .graphqlRequest<{ workerProviders: string[] }>(WORKER_PROVIDERS_QUERY)
      .then((response) => {
        const available = response.workerProviders || [];
        setProviders(available);
        if (available.length === 1) setValue("provider", available[0]);
      })
      .catch(notifyError);
  }, [ikApi, setValue]);

  // Prefill the provider configuration with its default, e.g. the default pod manifest
  useEffect(() => {
    if (!provider) return;
    ikApi
      .graphqlRequest<{
        workerTemplateDefaultConfiguration: Record<string, any>;
      }>(WORKER_TEMPLATE_DEFAULT_CONFIGURATION_QUERY, { provider })
      .then((response) =>
        setValue(
          "configuration",
          response.workerTemplateDefaultConfiguration || {},
        ),
      )
      .catch(notifyError);
  }, [ikApi, provider, setValue]);

  const handleSave = useCallback(
    async (data: WorkerTemplateCreate) => {
      setSaving(true);
      try {
        const input = {
          ...data,
          configuration: { ...data.configuration, provider: data.provider },
        };
        const response = await ikApi.graphqlRequest<{
          createWorkerTemplate: { id: string };
        }>(CREATE_WORKER_TEMPLATE_MUTATION, { input });
        const created = response.createWorkerTemplate;
        if (created?.id) {
          notify("Worker template created successfully", "success");
          navigate(`${linkPrefix}worker_templates/${created.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, navigate, linkPrefix],
  );

  const ConfigForm = WORKER_PROVIDER_FORMS[provider]?.ConfigForm;

  return (
    <FormProvider {...methods}>
      <PageContainer
        title="Create Worker Template"
        bottomActions={
          <>
            <Button onClick={() => navigate(`${linkPrefix}worker_templates`)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit(handleSave)}
              loading={saving}
            >
              Save
            </Button>
          </>
        }
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            minWidth: 320,
            width: "100%",
          }}
        >
          <PropertyCard title="Worker Template Definition">
            <Box>
              <Controller
                name="name"
                control={control}
                rules={{ required: "Name is required" }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Name"
                    required
                    variant="outlined"
                    error={!!errors.name}
                    helperText={
                      errors.name
                        ? errors.name.message
                        : "Provide a unique name"
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
                    helperText="Provide a short description"
                    fullWidth
                    margin="normal"
                  />
                )}
              />
              <Controller
                name="provider"
                control={control}
                rules={{ required: "Provider is required" }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Provider"
                    required
                    variant="outlined"
                    error={!!errors.provider}
                    helperText={
                      errors.provider
                        ? errors.provider.message
                        : WORKER_PROVIDER_FORMS[field.value]?.description ||
                          "Where workers are spawned"
                    }
                    fullWidth
                    margin="normal"
                  >
                    {providers.map((option) => (
                      <MenuItem key={option} value={option}>
                        {getWorkerProviderLabel(option)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="maxWorkers"
                control={control}
                rules={{
                  required: "Max workers is required",
                  min: { value: 1, message: "At least 1 worker" },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    onChange={(e) => field.onChange(toInt(e.target.value))}
                    type="number"
                    label="Max workers"
                    required
                    variant="outlined"
                    error={!!errors.maxWorkers}
                    helperText={
                      errors.maxWorkers
                        ? errors.maxWorkers.message
                        : "Maximum number of workers running at the same time from this template"
                    }
                    fullWidth
                    margin="normal"
                  />
                )}
              />
              <Controller
                name="idleTimeoutSeconds"
                control={control}
                rules={{
                  required: "Idle timeout is required",
                  min: { value: 30, message: "At least 30 seconds" },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    onChange={(e) => field.onChange(toInt(e.target.value))}
                    type="number"
                    label="Idle timeout (seconds)"
                    required
                    variant="outlined"
                    error={!!errors.idleTimeoutSeconds}
                    helperText={
                      errors.idleTimeoutSeconds
                        ? errors.idleTimeoutSeconds.message
                        : "A worker exits after being idle this long while no tasks are queued"
                    }
                    fullWidth
                    margin="normal"
                  />
                )}
              />
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    onChange={(e) => field.onChange(toInt(e.target.value))}
                    type="number"
                    label="Priority"
                    variant="outlined"
                    helperText="Templates with a higher priority are used first"
                    fullWidth
                    margin="normal"
                  />
                )}
              />
            </Box>
          </PropertyCard>
          {ConfigForm && (
            <PropertyCard title="Configuration">
              <Box>
                <ConfigForm control={control as Control<any>} errors={errors} />
              </Box>
            </PropertyCard>
          )}
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

WorkerTemplateCreatePage.path = "/worker_templates/create";
