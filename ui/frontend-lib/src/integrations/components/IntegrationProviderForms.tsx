import { Control, Controller, FieldErrors } from "react-hook-form";

import {
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";

interface FormValues {
  configuration: object;
}

export const renderFieldsForProvider = (
  provider: string,
  control: Control<any>,
  errors: FieldErrors<FormValues>,
  readonly: boolean = false,
  isCreateMode: boolean = false,
) => {
  switch (provider) {
    case "aws":
      return (
        <>
          <Controller
            name="configuration.aws_account"
            defaultValue=""
            rules={{
              required: "Account ID is required",
            }}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Account ID"
                fullWidth
                margin="normal"
                required
                placeholder="123456789012"
                error={!!(errors.configuration as FieldErrors)?.aws_account}
                helperText={
                  (errors.configuration as any)?.aws_account?.message ||
                  "Your AWS Account ID (12-digit number)"
                }
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.aws_access_key_id"
            control={control}
            defaultValue=""
            rules={{
              required: "Access key ID is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Access Key ID"
                fullWidth
                required
                margin="normal"
                placeholder="AKIA..."
                error={
                  !!(errors.configuration as FieldErrors)?.aws_access_key_id
                }
                helperText={
                  (errors.configuration as any)?.aws_access_key_id?.message ||
                  "AWS Access Key ID from your IAM user (starts with AKIA)"
                }
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.aws_secret_access_key"
            control={control}
            defaultValue=""
            rules={{
              required: "Secret access key is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Secret Access Key"
                type="password"
                fullWidth
                required
                margin="normal"
                placeholder="Enter your Secret Access Key"
                helperText={
                  (errors.configuration as any)?.aws_secret_access_key
                    ?.message ||
                  "AWS Secret Access Key corresponding to your Access Key ID. It will be stored securely and encrypted."
                }
                error={
                  !!(errors.configuration as FieldErrors)?.aws_secret_access_key
                }
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.aws_assumed_role_name"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Assumed Role Name"
                placeholder="Your role name"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)?.aws_assumed_role_name
                }
                helperText="Optional: Role name to assume"
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.aws_session_duration"
            control={control}
            defaultValue="3600"
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Session Duration (seconds)"
                placeholder="3600"
                type="number"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)?.aws_session_duration
                }
                helperText="Duration for the assumed role session in seconds"
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.aws_default_region"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="AWS Default Region"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)?.aws_default_region
                }
                helperText={
                  (errors.configuration as any)?.aws_default_region?.message ||
                  "Default AWS region for resource management (default to us-east-1 if not specified)"
                }
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          {isCreateMode && (
            <Controller
              name="create_storage"
              control={control}
              defaultValue={false}
              render={({ field }) => (
                <>
                  <FormControlLabel
                    control={<Checkbox {...field} checked={field.value} />}
                    label="Automatically create S3 bucket for OpenTofu/Terraform remote state management"
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", ml: 4 }}
                  >
                    S3 bucket named{" "}
                    <code>infrakitchen-{"{AWS_ACCOUNT_ID}"}-bucket</code> will
                    be created in <code>us-east-1</code> region.
                  </Typography>
                </>
              )}
            />
          )}
        </>
      );

    case "gcp":
      return (
        <>
          <Controller
            name="configuration.gcp_project_id"
            control={control}
            defaultValue=""
            rules={{
              required: "GCP Project ID is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="GCP Project ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.gcp_project_id}
                helperText={
                  (errors.configuration as any)?.gcp_project_id?.message ||
                  "Your Google Cloud Project ID"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.gcp_service_account_key"
            control={control}
            defaultValue=""
            rules={{
              required: "Service Account Key is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="GCP Service Account Key"
                fullWidth
                margin="normal"
                type="password"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.gcp_service_account_key
                }
                helperText={
                  (errors.configuration as any)?.gcp_service_account_key
                    ?.message || "JSON key for your GCP Service Account"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          {isCreateMode && (
            <Controller
              name="create_storage"
              control={control}
              defaultValue={false}
              render={({ field }) => (
                <>
                  <FormControlLabel
                    control={<Checkbox {...field} checked={field.value} />}
                    label="Automatically create storage for OpenTofu/Terraform remote state management"
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", ml: 4 }}
                  >
                    Google storage bucket named{" "}
                    <code>infrakitchen-{"{GCP Project ID}"}-bucket</code> will
                    be created in <code>us</code> region.
                  </Typography>
                </>
              )}
            />
          )}
        </>
      );

    case "azurerm":
      return (
        <>
          <Controller
            name="configuration.client_id"
            control={control}
            defaultValue=""
            rules={{
              required: "Client ID is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Client ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.client_id}
                helperText={
                  (errors.configuration as any)?.client_id?.message ||
                  "Azure Resource Manager Client ID"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.subscription_id"
            control={control}
            defaultValue=""
            rules={{
              required: "Subscription ID is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Subscription ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.subscription_id}
                helperText={
                  (errors.configuration as any)?.subscription_id?.message ||
                  "Azure Resource Manager Subscription ID"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.tenant_id"
            control={control}
            defaultValue=""
            rules={{
              required: "Tenant ID is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Tenant ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.tenant_id}
                helperText={
                  (errors.configuration as any)?.tenant_id?.message ||
                  "Azure Resource Manager Tenant ID"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.client_secret"
            control={control}
            defaultValue=""
            rules={{
              required: "Client Secret is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Client Secret"
                fullWidth
                margin="normal"
                type="password"
                error={!!(errors.configuration as FieldErrors)?.client_secret}
                helperText={
                  (errors.configuration as any)?.client_secret?.message ||
                  "Azure Resource Manager Client Secret"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );
    case "azure_devops":
      return (
        <>
          <Controller
            name="configuration.organization"
            control={control}
            defaultValue=""
            rules={{
              required: "Azure Organization is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Azure Organization"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.organization}
                helperText={
                  (errors.configuration as any)?.organization?.message ||
                  "Your Azure DevOps organization name"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
          <Controller
            name="configuration.azure_access_token"
            control={control}
            defaultValue=""
            rules={{
              required: "Azure Access Token is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Azure Access Token"
                fullWidth
                margin="normal"
                type="password"
                error={
                  !!(errors.configuration as FieldErrors)?.azure_access_token
                }
                helperText={
                  (errors.configuration as any)?.azure_access_token?.message ||
                  "Personal Access Token for Azure DevOps"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );
    case "azure_devops_ssh":
      return (
        <>
          <Controller
            name="configuration.azure_ssh_private_key"
            control={control}
            defaultValue=""
            rules={{
              required: "Azure SSH Private Key is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Azure SSH Private Key"
                multiline
                minRows={4}
                maxRows={8}
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)?.azure_ssh_private_key
                }
                helperText={
                  (errors.configuration as any)?.azure_ssh_private_key
                    ?.message ||
                  "SSH private key for Azure DevOps repository access"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );

    case "mongodb_atlas":
      return (
        <>
          <Controller
            name="configuration.mongodb_atlas_org_id"
            control={control}
            defaultValue=""
            rules={{ required: "Org ID is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="MongoDB Atlas Org ID"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)?.mongodb_atlas_org_id
                }
                helperText={
                  (errors.configuration as any)?.mongodb_atlas_org_id
                    ?.message || "Your MongoDB Atlas Organization ID"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />

          <Controller
            name="configuration.mongodb_atlas_public_key"
            control={control}
            defaultValue=""
            rules={{ required: "Public key is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="MongoDB Atlas Public Key"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.mongodb_atlas_public_key
                }
                helperText={
                  (errors.configuration as any)?.mongodb_atlas_public_key
                    ?.message || "Your MongoDB Atlas API Public Key"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />

          <Controller
            name="configuration.mongodb_atlas_private_key"
            control={control}
            defaultValue=""
            rules={{ required: "Private key is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="MongoDB Atlas Private Key"
                fullWidth
                margin="normal"
                type="password"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.mongodb_atlas_private_key
                }
                helperText={
                  (errors.configuration as any)?.mongodb_atlas_private_key
                    ?.message || "Your MongoDB Atlas API Private Key"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );

    case "datadog":
      return (
        <>
          <Controller
            name="configuration.datadog_api_url"
            control={control}
            defaultValue=""
            rules={{ required: "API URL is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Datadog API URL"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.datadog_api_url}
                helperText={
                  !!(errors.configuration as FieldErrors)?.datadog_api_url
                    ?.message
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />

          <Controller
            name="configuration.datadog_api_key"
            control={control}
            defaultValue=""
            rules={{
              required: "Datadog API Key is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Datadog API Key"
                fullWidth
                margin="normal"
                type="password"
                error={
                  !!(errors.configuration as FieldErrors)?.data_dog_api_key
                }
                helperText={
                  (errors.configuration as any)?.data_dog_api_key?.message ||
                  "Your Datadog API key for authentication"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />

          <Controller
            name="configuration.datadog_app_key"
            control={control}
            defaultValue=""
            rules={{
              required: "Datadog App Key is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Datadog App Key"
                fullWidth
                margin="normal"
                type="password"
                error={
                  !!(errors.configuration as FieldErrors)?.data_dog_app_key
                }
                helperText={
                  (errors.configuration as any)?.data_dog_app_key?.message ||
                  "Your Datadog Application key"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );

    case "github":
      return (
        <>
          <Controller
            name="configuration.github_client_secret"
            control={control}
            defaultValue=""
            rules={{
              required: "GitHub Personal Access Token is required",
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="GitHub Personal Access Token"
                fullWidth
                margin="normal"
                type="password"
                error={
                  !!(errors.configuration as FieldErrors)?.github_client_secret
                }
                helperText={
                  (errors.configuration as any)?.github_client_secret
                    ?.message ||
                  "The token will be securely stored and encrypted"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );
    case "github_ssh":
      return (
        <>
          <Controller
            name="configuration.github_ssh_private_key"
            control={control}
            defaultValue=""
            rules={{ required: "SSH key is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="GitHub SSH Private Key"
                multiline
                minRows={4}
                maxRows={8}
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.github_ssh_private_key
                }
                helperText={
                  (errors.configuration as any)?.github_ssh_private_key
                    ?.message || "SSH private key for GitHub repository access"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );

    case "bitbucket_ssh":
      return (
        <>
          <Controller
            name="configuration.bitbucket_ssh_private_key"
            control={control}
            defaultValue=""
            rules={{ required: "SSH key is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Bitbucket SSH Private Key"
                multiline
                minRows={4}
                maxRows={8}
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)
                    ?.bitbucket_ssh_private_key
                }
                helperText={
                  (errors.configuration as any)?.bitbucket_ssh_private_key
                    ?.message ||
                  "SSH private key for Bitbucket repository access"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );

    case "bitbucket":
      return (
        <>
          <Controller
            name="configuration.bitbucket_user"
            control={control}
            defaultValue=""
            rules={{ required: "User email is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Bitbucket User Email"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.bitbucket_user}
                helperText={
                  (errors.configuration as any)?.bitbucket_user?.message ||
                  "Email address associated with your Bitbucket account"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />

          <Controller
            name="configuration.bitbucket_key"
            control={control}
            defaultValue=""
            rules={{ required: "Bitbucket API token is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Bitbucket API Token"
                fullWidth
                margin="normal"
                type="password"
                error={!!(errors.configuration as FieldErrors)?.bitbucket_key}
                helperText={
                  (errors.configuration as any)?.bitbucket_key?.message ||
                  "App password or API token for Bitbucket access"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );
    case "vault":
      return (
        <>
          <Controller
            name="configuration.vault_domain"
            control={control}
            defaultValue=""
            rules={{ required: "Vault domain is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Vault Domain"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.vault_domain}
                helperText={
                  (errors.configuration as any)?.vault_domain?.message ||
                  "Vault server domain or URL"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />

          <Controller
            name="configuration.vault_token"
            control={control}
            defaultValue=""
            rules={{ required: "Vault token is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Vault Token"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.vault_token}
                helperText={
                  (errors.configuration as any)?.vault_token?.message ||
                  "Vault authentication token"
                }
                required
                slotProps={{ input: { readOnly: readonly } }}
              />
            )}
          />
        </>
      );
    default:
      return null;
  }
};
