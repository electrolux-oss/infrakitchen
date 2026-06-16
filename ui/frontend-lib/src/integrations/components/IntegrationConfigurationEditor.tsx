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
import {
  IntegrationUpdateFieldInput,
  UPDATE_INTEGRATION_MUTATION,
} from "../graphql/mutations";
import { IntegrationResponse } from "../types";

import { renderFieldsForProvider } from "./IntegrationProviderForms";

export interface IntegrationConfigurationEditorProps {
  integration: IntegrationResponse;
  canEdit: boolean;
}

/**
 * Dialog-based configuration editor for integration provider-specific fields.
 * Follows the TemplateDocumentationField pattern: shows an "Edit" button that
 * opens a dialog with the provider form, and saves via GraphQL mutation.
 *
 * Preserves the old Edit page behaviour of injecting `integration_provider`
 * into the configuration payload on save.
 */
export const IntegrationConfigurationEditor = ({
  integration,
  canEdit,
}: IntegrationConfigurationEditorProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const methods = useForm<{ configuration: Record<string, any> }>({
    mode: "onChange",
    defaultValues: {
      configuration: integration.configuration,
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = methods;

  const openDialog = useCallback(() => {
    reset({ configuration: integration.configuration });
    setDialogOpen(true);
  }, [integration.configuration, reset]);

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const saveConfiguration = useCallback(
    async (data: { configuration: Record<string, any> }) => {
      setSaving(true);
      try {
        const input: IntegrationUpdateFieldInput = {
          configuration: {
            ...data.configuration,
            integration_provider: integration.integrationProvider,
          },
        };
        await ikApi.graphqlRequest(UPDATE_INTEGRATION_MUTATION, {
          id: integration.id,
          input,
        });
        notify("Integration configuration updated successfully", "success");
        refreshEntity?.();
        setDialogOpen(false);
      } catch (error) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, integration.id, integration.integrationProvider, refreshEntity],
  );

  const providerFields = renderFieldsForProvider(
    integration.integrationProvider,
    control as Control<any>,
    errors,
  );

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
              integration.integrationProvider,
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

export default IntegrationConfigurationEditor;
