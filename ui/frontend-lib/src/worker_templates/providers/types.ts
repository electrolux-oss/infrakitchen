import { ComponentType } from "react";

import { Control, FieldErrors } from "react-hook-form";

export interface WorkerProviderFormProps {
  control: Control<any>;
  errors?: FieldErrors<any> & Record<string, any>;
  readOnly?: boolean;
}

export interface WorkerProviderDefinition {
  label: string;
  description: string;
  /** Renders the provider-specific fields under `configuration.*` of a react-hook-form form. */
  ConfigForm: ComponentType<WorkerProviderFormProps>;
}
