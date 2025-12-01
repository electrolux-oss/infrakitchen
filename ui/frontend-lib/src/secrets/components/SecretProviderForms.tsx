import { Control, Controller, FieldErrors } from "react-hook-form";

import { TextField } from "@mui/material";

import CustomSecretInput from "./CustomSecretInput";

interface FormValues {
  configuration: object;
}

export const renderFieldsForProvider = (
  provider: string,
  control: Control<any>,
  errors: FieldErrors<FormValues>,
) => {
  switch (provider) {
    case "custom":
      return (
        <Controller
          name="configuration.secrets"
          control={control}
          render={({ field }) => (
            <CustomSecretInput {...field} label="Secret list" errors={errors} />
          )}
        />
      );
    case "aws":
      return (
        <>
          <Controller
            name="configuration.name"
            control={control}
            defaultValue=""
            rules={{ required: "Secret name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Secret Name"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.name}
                helperText={
                  !!(errors.configuration as FieldErrors)?.name?.message
                }
              />
            )}
          />
          <Controller
            name="configuration.aws_region"
            control={control}
            defaultValue=""
            rules={{ required: "Region is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Region for Secret"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.aws_region}
                helperText={
                  !!(errors.configuration as FieldErrors)?.aws_region?.message
                }
              />
            )}
          />
        </>
      );
    case "gcp":
      return (
        <>
          <Controller
            name="configuration.name"
            control={control}
            defaultValue=""
            rules={{ required: "Secret name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="GCP Secret Name"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.name}
                helperText={
                  !!(errors.configuration as FieldErrors)?.name?.message
                }
              />
            )}
          />
          <Controller
            name="configuration.gcp_region"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="GCP Secret Region"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.gcp_region}
                helperText={"Leave blank to use default region"}
              />
            )}
          />
        </>
      );
    default:
      return null;
  }
};
