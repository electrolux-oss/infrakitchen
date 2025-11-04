import { Control, Controller, FieldErrors } from "react-hook-form";

import { TextField } from "@mui/material";

interface FormValues {
  configuration: object;
}

export const renderFieldsForProvider = (
  provider: string,
  control: Control<any>,
  errors: FieldErrors<FormValues>,
) => {
  switch (provider) {
    case "microsoft":
      return (
        <>
          <Controller
            name="configuration.client_id"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Client ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.client_id}
              />
            )}
          />
          <Controller
            name="configuration.client_secret"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Client Secret"
                type="password"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.client_secret}
              />
            )}
          />
          <Controller
            name="configuration.tenant_id"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Tenant ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.tenant_id}
              />
            )}
          />
          <Controller
            name="configuration.redirect_uri"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Redirect URI"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.redirect_uri}
              />
            )}
          />
        </>
      );

    case "github":
      return (
        <>
          <Controller
            name="configuration.client_id"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Client ID"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.client_id}
              />
            )}
          />
          <Controller
            name="configuration.client_secret"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Client Secret"
                type="password"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.client_secret}
              />
            )}
          />
          <Controller
            name="configuration.redirect_uri"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Redirect URI"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.redirect_uri}
              />
            )}
          />
        </>
      );

    case "backstage":
      return (
        <>
          <Controller
            name="configuration.backstage_private_key"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Private Key"
                fullWidth
                margin="normal"
                multiline
                error={
                  !!(errors.configuration as FieldErrors)?.backstage_private_key
                }
              />
            )}
          />
          <Controller
            name="configuration.backstage_jwks_url"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="JWKS URL"
                fullWidth
                margin="normal"
                error={
                  !!(errors.configuration as FieldErrors)?.backstage_jwks_url
                }
              />
            )}
          />
        </>
      );

    case "ik_service_account":
      return (
        <>
          <Controller
            name="configuration.token_ttl"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                label="Token TTL (seconds)"
                type="number"
                fullWidth
                margin="normal"
                error={!!(errors.configuration as FieldErrors)?.token_ttl}
              />
            )}
          />
        </>
      );

    case "guest":
      return <></>; // no config fields

    default:
      return null;
  }
};
