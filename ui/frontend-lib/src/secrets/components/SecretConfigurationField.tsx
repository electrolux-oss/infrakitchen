import { useState } from "react";

import { Control, FormProvider, useForm } from "react-hook-form";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

import { SecretResponse, SecretUpdate } from "../types";

import { renderFieldsForProvider } from "./SecretProviderForms";

export interface SecretConfigurationFieldProps {
  /** The full secret entity (provides provider type and current configuration). */
  secret: SecretResponse;
  /** Whether the current user is allowed to edit the configuration. */
  canEdit: boolean;
  /** Persists the new configuration. Should throw on failure. */
  onSave: (configuration: SecretUpdate["configuration"]) => Promise<void>;
}

/**
 * Edit button + dialog for provider-specific secret configuration, following
 * the TemplateDocumentationField pattern. Reuses the existing
 * `SecretProviderForms` components inside a dialog-scoped react-hook-form.
 */
export const SecretConfigurationField = ({
  secret,
  canEdit,
  onSave,
}: SecretConfigurationFieldProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const methods = useForm<SecretUpdate>({
    mode: "onChange",
    defaultValues: {
      configuration: secret.configuration,
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = methods;

  const openDialog = () => {
    reset({ configuration: secret.configuration });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const save = handleSubmit(async (data) => {
    setSaving(true);
    try {
      await onSave(data.configuration);
      setDialogOpen(false);
    } catch {
      // Error already surfaced by onSave; keep the dialog open.
    } finally {
      setSaving(false);
    }
  });

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
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
        <DialogTitle>Edit Secret Configuration</DialogTitle>
        <DialogContent>
          <FormProvider {...methods}>
            {renderFieldsForProvider(
              secret.secretProvider,
              control as Control<any>,
              errors,
            )}
          </FormProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SecretConfigurationField;
