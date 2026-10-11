import { Controller } from "react-hook-form";

import { TextField } from "@mui/material";

import { YamlEditorField } from "../components/YamlEditorField";

import { WorkerProviderFormProps } from "./types";

export const KubernetesWorkerConfigForm = ({
  control,
  errors,
  readOnly = false,
}: WorkerProviderFormProps) => (
  <>
    <Controller
      name="configuration.namespace"
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          value={field.value ?? ""}
          onChange={(e) => field.onChange(e.target.value || null)}
          label="Namespace"
          variant="outlined"
          helperText="Namespace for worker pods. Defaults to the namespace InfraKitchen runs in."
          fullWidth
          margin="normal"
          disabled={readOnly}
        />
      )}
    />
    <Controller
      name="configuration.pod_manifest"
      control={control}
      rules={{ required: "Pod manifest is required" }}
      render={({ field }) => (
        <YamlEditorField
          label="Pod manifest"
          value={field.value ?? ""}
          onChange={field.onChange}
          readOnly={readOnly}
          error={errors?.configuration?.pod_manifest?.message}
          helperText={
            "A Pod running the InfraKitchen worker. The first container inherits the image and " +
            "settings (database, keys) of InfraKitchen, so leave them out unless you want to override them. " +
            "InfraKitchen also sets the pod name, labels and restartPolicy: Never."
          }
        />
      )}
    />
  </>
);
