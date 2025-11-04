import { Control, Controller, FieldErrors } from "react-hook-form";

import { MenuItem, TextField } from "@mui/material";

interface FormValues {
  configuration: object;
}

const gcp_storage_regions = ["US", "EU", "ASIA"];

export const renderFieldsForProvider = (
  provider: string,
  control: Control<any>,
  errors: FieldErrors<FormValues>,
) => {
  switch (provider) {
    case "aws":
      return (
        <>
          <Controller
            name="configuration.aws_bucket_name"
            control={control}
            defaultValue=""
            rules={{ required: "Bucket name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS S3 Bucket Name"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.aws_bucket_name}
                helperText={
                  !!(errors.configuration as FieldErrors)?.aws_bucket_name
                    ?.message
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
                label="AWS Region for S3 Bucket"
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

    case "azurerm":
      return (
        <>
          <Controller
            name="configuration.azurerm_resource_group_name"
            control={control}
            defaultValue=""
            rules={{ required: "Resource group name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Azure Resource Group Name"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.azurerm_resource_group_name
                }
                helperText={
                  !!(errors.configuration as FieldErrors)
                    ?.azurerm_resource_group_name?.message
                }
              />
            )}
          />
          <Controller
            name="configuration.azurerm_storage_account_name"
            control={control}
            defaultValue=""
            rules={{ required: "Storage account name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Azure Storage Account Name"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.azurerm_storage_account_name
                }
                helperText={
                  !!(errors.configuration as FieldErrors)
                    ?.azurerm_storage_account_name?.message
                }
              />
            )}
          />
          <Controller
            name="configuration.azurerm_container_name"
            control={control}
            defaultValue=""
            rules={{ required: "Container name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Azure Container Name"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.azurerm_container_name
                }
                helperText={
                  !!(errors.configuration as FieldErrors)
                    ?.azurerm_container_name?.message
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
            name="configuration.gcp_bucket_name"
            control={control}
            defaultValue=""
            rules={{ required: "Bucket name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="GCP Bucket Name"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.gcp_bucket_name}
                helperText={
                  !!(errors.configuration as FieldErrors)?.gcp_bucket_name
                    ?.message
                }
              />
            )}
          />
          <Controller
            name="configuration.gcp_region"
            control={control}
            defaultValue=""
            rules={{ required: "Region is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="GCP Region for Bucket"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.gcp_region}
                helperText={
                  !!(errors.configuration as FieldErrors)?.gcp_region?.message
                }
              >
                {gcp_storage_regions.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </>
      );
    default:
      return null;
  }
};
