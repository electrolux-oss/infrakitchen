import { Control, Controller, FieldErrors, FieldValues } from "react-hook-form";

import { Autocomplete, Chip, TextField } from "@mui/material";

import { getProviderDisplayName } from "../../common/utils";
import { INTEGRATION_PROVIDER_OPTIONS } from "../constants";
import { IntegrationProviderType, TemplateConfig } from "../types";

export type TemplateConfigurationControl = Control<
  { configuration: TemplateConfig } & FieldValues
>;

interface TemplateConfigurationFieldsProps {
  control: TemplateConfigurationControl;
  errors: FieldErrors<{ configuration: TemplateConfig } & FieldValues>;
}

export const TemplateConfigurationFields = ({
  control,
  errors,
}: TemplateConfigurationFieldsProps) => (
  <>
    <Controller
      name="configuration.oneResourcePerIntegration"
      control={control}
      render={({ field }) => (
        <Autocomplete
          multiple
          options={INTEGRATION_PROVIDER_OPTIONS}
          value={field.value || []}
          onChange={(_event, newValue) => field.onChange(newValue)}
          getOptionLabel={(option) => getProviderDisplayName(option)}
          renderValue={(
            value: readonly IntegrationProviderType[],
            getTagProps,
          ) =>
            value.map((option: IntegrationProviderType, index: number) => {
              const { key, ...rest } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  {...rest}
                  variant="outlined"
                  label={getProviderDisplayName(option)}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Integration Providers to filter on"
              error={!!errors.configuration?.oneResourcePerIntegration}
              helperText={
                errors.configuration?.oneResourcePerIntegration
                  ? errors.configuration.oneResourcePerIntegration.message
                  : "Enforce one resource per integration for selected providers (empty means all providers)"
              }
              fullWidth
              margin="normal"
            />
          )}
        />
      )}
    />
    <Controller
      name="configuration.allowedProviderIntegrationTypes"
      control={control}
      render={({ field }) => (
        <Autocomplete
          multiple
          options={INTEGRATION_PROVIDER_OPTIONS}
          value={field.value || []}
          onChange={(_event, newValue) => field.onChange(newValue)}
          getOptionLabel={(option) => getProviderDisplayName(option)}
          renderValue={(
            value: readonly IntegrationProviderType[],
            getTagProps,
          ) =>
            value.map((option: IntegrationProviderType, index: number) => {
              const { key, ...rest } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  {...rest}
                  variant="outlined"
                  label={getProviderDisplayName(option)}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Allowed Integration Providers"
              error={!!errors.configuration?.allowedProviderIntegrationTypes}
              helperText={
                errors.configuration?.allowedProviderIntegrationTypes
                  ? errors.configuration.allowedProviderIntegrationTypes.message
                  : "Restrict template usage to selected providers (empty means all providers)"
              }
              fullWidth
              margin="normal"
            />
          )}
        />
      )}
    />
    <Controller
      name="configuration.requiredConfigurationVariables"
      control={control}
      render={({ field }) => (
        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={field.value || []}
          onChange={(_event, newValue) => field.onChange(newValue)}
          renderValue={(value: readonly string[], getTagProps) =>
            value.map((option: string, index: number) => {
              const { key, ...rest } = getTagProps({ index });
              return (
                <Chip key={key} {...rest} variant="outlined" label={option} />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Required Configuration Variables"
              helperText="Dependency config variable names that must be provided when creating a resource"
              fullWidth
              margin="normal"
            />
          )}
        />
      )}
    />
  </>
);
