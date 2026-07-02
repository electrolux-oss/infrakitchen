import { useCallback, useState } from "react";

import { Control, FormProvider, useForm } from "react-hook-form";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { GqlAuthProvider } from "../graphql";
import {
  AuthProviderUpdateFieldInput,
  UPDATE_AUTH_PROVIDER_MUTATION,
} from "../graphql/mutations";

import { renderFieldsForProvider } from "./AuthProviderForms";

export interface AuthProviderConfigurationEditorProps {
  authProvider: GqlAuthProvider;
  canEdit: boolean;
}

/**
 * Dialog-based configuration editor for auth provider-specific fields.
 * Shows an "Edit Configuration" button that opens a dialog with the provider
 * form, and saves via GraphQL mutation.
 *
 * Preserves the old Edit page behaviour of injecting `auth_provider` (snake_case
 * discriminator) into the configuration payload on save.
 */
export const AuthProviderConfigurationEditor = ({
  authProvider,
  canEdit,
}: AuthProviderConfigurationEditorProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const methods = useForm<{ configuration: Record<string, any> }>({
    mode: "onChange",
    defaultValues: {
      configuration: authProvider.configuration || {},
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = methods;

  const openDialog = useCallback(() => {
    reset({ configuration: authProvider.configuration || {} });
    setDialogOpen(true);
  }, [authProvider.configuration, reset]);

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const saveConfiguration = useCallback(
    async (data: { configuration: Record<string, any> }) => {
      setSaving(true);
      try {
        const input: AuthProviderUpdateFieldInput = {
          configuration: {
            ...data.configuration,
            auth_provider: authProvider.authProvider,
          },
        };
        await ikApi.graphqlRequest(UPDATE_AUTH_PROVIDER_MUTATION, {
          id: authProvider.id,
          input,
        });
        notify("Auth Provider configuration updated successfully", "success");
        refreshEntity?.();
        setDialogOpen(false);
      } catch (error) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, authProvider.id, authProvider.authProvider, refreshEntity],
  );

  const providerFields = renderFieldsForProvider(
    authProvider.authProvider,
    control as Control<any>,
    errors,
  );

  // guest provider has no configuration fields
  if (!providerFields) return null;

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={openDialog}
          disabled={!canEdit}
        >
          Edit Configuration
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <FormProvider {...methods}>
          <DialogTitle>Edit Configuration</DialogTitle>
          <DialogContent>
            {renderFieldsForProvider(
              authProvider.authProvider,
              control as Control<any>,
              errors,
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit(saveConfiguration)}
              disabled={saving}
            >
              Save
            </Button>
          </DialogActions>
        </FormProvider>
      </Dialog>
    </>
  );
};

export default AuthProviderConfigurationEditor;
