import { TextField } from "../../ui";
import { KubernetesWorkerConfiguration, WorkerConfiguration } from "../graphql";

import { YamlEditorField } from "./YamlEditorField";

const KubernetesForm = ({
  value,
  onChange,
  disabled,
}: {
  value: KubernetesWorkerConfiguration;
  onChange: (value: KubernetesWorkerConfiguration) => void;
  disabled?: boolean;
}) => (
  <>
    <TextField
      label="Namespace"
      value={value.namespace ?? ""}
      onChange={(event) =>
        onChange({ ...value, namespace: event.target.value || null })
      }
      helperText="Namespace for worker pods. Defaults to the namespace InfraKitchen runs in."
      fullWidth
      margin="normal"
      disabled={disabled}
    />
    <YamlEditorField
      label="Pod manifest"
      value={value.pod_manifest}
      onChange={(podManifest) =>
        onChange({ ...value, pod_manifest: podManifest })
      }
      readOnly={disabled}
      helperText="The first container is the worker. It inherits InfraKitchen's image and settings unless set here."
    />
  </>
);

export interface WorkerConfigurationFormProps {
  value: WorkerConfiguration;
  onChange: (value: WorkerConfiguration) => void;
  disabled?: boolean;
}

/** Provider specific configuration fields of a worker template. */
export const WorkerConfigurationForm = ({
  value,
  onChange,
  disabled,
}: WorkerConfigurationFormProps) => {
  switch (value.provider) {
    case "kubernetes":
      return (
        <KubernetesForm value={value} onChange={onChange} disabled={disabled} />
      );
    default:
      return null;
  }
};
