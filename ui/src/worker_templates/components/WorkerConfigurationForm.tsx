import { useEffect, useState } from "react";

import { TextField } from "../../ui";
import {
  DockerWorkerConfiguration,
  KubernetesWorkerConfiguration,
  WorkerConfiguration,
} from "../graphql";

import { YamlEditorField } from "./YamlEditorField";

const splitLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const envToText = (env: Record<string, string>): string =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

const textToEnv = (text: string): Record<string, string> =>
  Object.fromEntries(
    splitLines(text)
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1)];
      }),
  );

/**
 * Multi-line text field holding a list (one entry per line). Keeps its own text
 * so blank lines can be typed, and reports the parsed value on every change.
 */
const LinesField = <T,>({
  label,
  value,
  toText,
  fromText,
  onChange,
  helperText,
  disabled,
}: {
  label: string;
  value: T;
  toText: (value: T) => string;
  fromText: (text: string) => T;
  onChange: (value: T) => void;
  helperText: string;
  disabled?: boolean;
}) => {
  const [text, setText] = useState(() => toText(value));

  // Only resync when the value changed from outside (e.g. a dialog reset)
  useEffect(() => {
    setText((current) =>
      toText(fromText(current)) === toText(value) ? current : toText(value),
    );
  }, [value, toText, fromText]);

  return (
    <TextField
      label={label}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(fromText(event.target.value));
      }}
      helperText={helperText}
      multiline
      rows={3}
      fullWidth
      margin="normal"
      disabled={disabled}
      inputProps={{ className: "font-mono" }}
    />
  );
};

const joinLines = (lines: string[]) => lines.join("\n");

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

const DockerForm = ({
  value,
  onChange,
  disabled,
}: {
  value: DockerWorkerConfiguration;
  onChange: (value: DockerWorkerConfiguration) => void;
  disabled?: boolean;
}) => {
  const set = <K extends keyof DockerWorkerConfiguration>(
    key: K,
    fieldValue: DockerWorkerConfiguration[K],
  ) => onChange({ ...value, [key]: fieldValue });

  return (
    <>
      <TextField
        label="Docker host"
        value={value.docker_host}
        onChange={(event) => set("docker_host", event.target.value)}
        helperText="unix:///var/run/docker.sock, tcp://host:2375 or http(s)://"
        fullWidth
        margin="normal"
        disabled={disabled}
      />
      <TextField
        label="Image"
        value={value.image ?? ""}
        onChange={(event) => set("image", event.target.value || null)}
        helperText="Defaults to the image of the InfraKitchen container. Pulled if missing."
        fullWidth
        margin="normal"
        disabled={disabled}
      />
      <TextField
        label="Network"
        value={value.network ?? ""}
        onChange={(event) => set("network", event.target.value || null)}
        helperText="Defaults to the network of the InfraKitchen container."
        fullWidth
        margin="normal"
        disabled={disabled}
      />
      <LinesField
        label="Command"
        value={value.command}
        toText={joinLines}
        fromText={splitLines}
        onChange={(command) => set("command", command)}
        helperText="One argument per line."
        disabled={disabled}
      />
      <LinesField
        label="Environment"
        value={value.env}
        toText={envToText}
        fromText={textToEnv}
        onChange={(env) => set("env", env)}
        helperText="KEY=value per line. Added to the environment inherited from InfraKitchen."
        disabled={disabled}
      />
      <LinesField
        label="Volumes"
        value={value.volumes}
        toText={joinLines}
        fromText={splitLines}
        onChange={(volumes) => set("volumes", volumes)}
        helperText="source:target or source:target:ro per line."
        disabled={disabled}
      />
      <LinesField
        label="Extra hosts"
        value={value.extra_hosts}
        toText={joinLines}
        fromText={splitLines}
        onChange={(extraHosts) => set("extra_hosts", extraHosts)}
        helperText="host:ip per line, added to /etc/hosts."
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <TextField
          label="Memory limit"
          value={value.memory ?? ""}
          onChange={(event) => set("memory", event.target.value || null)}
          helperText="e.g. 2g"
          fullWidth
          margin="normal"
          disabled={disabled}
        />
        <TextField
          label="CPU limit"
          type="number"
          value={value.cpus ?? ""}
          onChange={(event) =>
            set("cpus", event.target.value ? Number(event.target.value) : null)
          }
          helperText="e.g. 1.5"
          fullWidth
          margin="normal"
          disabled={disabled}
          inputProps={{ min: 0, step: 0.5 }}
        />
      </div>
    </>
  );
};

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
    case "docker":
      return (
        <DockerForm value={value} onChange={onChange} disabled={disabled} />
      );
    default:
      return null;
  }
};
