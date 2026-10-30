import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { getProviderValue } from "../../common/components/fields/CommonField";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { Autocomplete, Button, MenuItem, TextField } from "../../ui";
import { WorkerConfigurationForm } from "../components/WorkerConfigurationForm";
import {
  CREATE_WORKER_TEMPLATE_MUTATION,
  VALIDATE_WORKER_TEMPLATE_DRAFT_MUTATION,
  WORKER_PROVIDERS_QUERY,
  WORKER_TEMPLATE_DEFAULT_CONFIGURATION_QUERY,
  WorkerConfiguration,
} from "../graphql";

interface WorkerTemplateForm {
  name: string;
  description: string;
  provider: string;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  labels: string[];
}

export const WorkerTemplateCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkerTemplateForm>({
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      provider: "kubernetes",
      maxWorkers: 3,
      idleTimeoutSeconds: 300,
      labels: [],
    },
  });

  const [providers, setProviders] = useState<string[]>([]);
  const [configuration, setConfiguration] =
    useState<WorkerConfiguration | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const provider = watch("provider");

  useEffect(() => {
    ikApi
      .graphqlRequest<{ workerProviders: string[] }>(WORKER_PROVIDERS_QUERY)
      .then((response) => setProviders(response.workerProviders))
      .catch(notifyError);
  }, [ikApi]);

  // Prefill the configuration with the provider's defaults
  useEffect(() => {
    if (!provider) return;
    setConfiguration(null);
    ikApi
      .graphqlRequest<{
        workerTemplateDefaultConfiguration: WorkerConfiguration;
      }>(WORKER_TEMPLATE_DEFAULT_CONFIGURATION_QUERY, { provider })
      .then((response) =>
        setConfiguration(response.workerTemplateDefaultConfiguration),
      )
      .catch(notifyError);
  }, [ikApi, provider]);

  const toInput = useCallback(
    (data: WorkerTemplateForm) => ({
      ...data,
      maxWorkers: Number(data.maxWorkers),
      idleTimeoutSeconds: Number(data.idleTimeoutSeconds),
      configuration,
    }),
    [configuration],
  );

  const validate = useCallback(
    async (data: WorkerTemplateForm) => {
      if (!configuration) return;
      setValidating(true);
      try {
        const response = await ikApi.graphqlRequest<{
          validateWorkerTemplateDraft: {
            isValid: boolean;
            message: string | null;
          };
        }>(VALIDATE_WORKER_TEMPLATE_DRAFT_MUTATION, { input: toInput(data) });
        const { isValid, message } = response.validateWorkerTemplateDraft;
        notify(
          message || (isValid ? "Worker template is valid" : "Invalid"),
          isValid ? "success" : "error",
        );
      } catch (error) {
        notifyError(error);
      } finally {
        setValidating(false);
      }
    },
    [ikApi, configuration, toInput],
  );

  const save = useCallback(
    async (data: WorkerTemplateForm) => {
      if (!configuration) return;
      setSaving(true);
      try {
        const response = await ikApi.graphqlRequest<{
          createWorkerTemplate: { id: string };
        }>(CREATE_WORKER_TEMPLATE_MUTATION, { input: toInput(data) });
        const created = response.createWorkerTemplate;
        if (created?.id) {
          notify("Worker template created", "success");
          navigate(`${linkPrefix}worker_templates/${created.id}`);
        }
      } catch (error) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, configuration, toInput, navigate, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Worker Template"
      bottomActions={
        <>
          <Button onClick={() => navigate(`${linkPrefix}worker_templates`)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(validate)}
            disabled={validating || saving || !configuration}
          >
            {validating ? "Validating..." : "Validate"}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit(save)}
            disabled={saving || !configuration}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex w-full min-w-80 flex-col items-center">
        <PropertyCard title="Worker Template">
          <div>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  required
                  error={!!errors.name}
                  helperText={
                    errors.name?.message ??
                    "Unique name; spawned workers are named after it and it cannot be changed later"
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
                  error={!!errors.provider}
                  helperText={
                    errors.provider?.message ??
                    "Where workers are started; cannot be changed later"
                  }
                  fullWidth
                  margin="normal"
                >
                  {providers.map((option) => (
                    <MenuItem key={option} value={option}>
                      {getProviderValue(option, 18)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Controller
                name="maxWorkers"
                control={control}
                rules={{ min: { value: 1, message: "At least 1" } }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Max workers"
                    error={!!errors.maxWorkers}
                    helperText={
                      errors.maxWorkers?.message ?? "Running at the same time"
                    }
                    inputProps={{ min: 1 }}
                    fullWidth
                    margin="normal"
                  />
                )}
              />
              <Controller
                name="idleTimeoutSeconds"
                control={control}
                rules={{ min: { value: 30, message: "At least 30 seconds" } }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Idle timeout (seconds)"
                    error={!!errors.idleTimeoutSeconds}
                    helperText={
                      errors.idleTimeoutSeconds?.message ??
                      "Idle workers exit after this"
                    }
                    inputProps={{ min: 30 }}
                    fullWidth
                    margin="normal"
                  />
                )}
              />
            </div>
            <Controller
              name="labels"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  freeSolo
                  options={[] as string[]}
                  value={field.value}
                  onChange={(_event, value) => field.onChange(value)}
                  label="Labels"
                  helperText="Add labels and press Enter"
                  fullWidth
                  margin="normal"
                />
              )}
            />
          </div>
        </PropertyCard>
        <PropertyCard title="Configuration">
          <div>
            {configuration ? (
              <WorkerConfigurationForm
                value={configuration}
                onChange={setConfiguration}
              />
            ) : (
              <p className="text-body2 text-fg-muted">Loading defaults...</p>
            )}
          </div>
        </PropertyCard>
      </div>
    </PageContainer>
  );
};

WorkerTemplateCreatePage.path = "/worker_templates/create";
