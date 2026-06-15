import { useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GridSize,
} from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { MarkdownEditor } from "../../common/components/inputs/MarkdownEditor";

export interface TemplateDocumentationFieldProps {
  /** Current documentation markdown, if any. */
  documentation: string | null | undefined;
  /** Whether the current user is allowed to edit the documentation. */
  canEdit: boolean;
  /** Persists the new documentation. Should throw on failure. */
  onSave: (documentation: string) => Promise<void>;
  /** Grid sizing for the underlying field cell. */
  size?: GridSize | { xs: GridSize; md: GridSize } | undefined;
}

/**
 * Documentation field with a dedicated markdown editing dialog. Owns its own
 * dialog/draft/saving state so the parent overview only needs to provide the
 * current value and a save handler.
 */
export const TemplateDocumentationField = ({
  documentation,
  canEdit,
  onSave,
  size = 6,
}: TemplateDocumentationFieldProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    setDraft(documentation ?? "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setDialogOpen(false);
    } catch {
      // Error already surfaced by onSave; keep the dialog open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CommonField
        name={"Documentation"}
        value={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
            }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {documentation ? (
                <span>Documentation provided</span>
              ) : (
                <span>No documentation</span>
              )}
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={openDialog}
              disabled={!canEdit}
            >
              Edit
            </Button>
          </Box>
        }
        size={size}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>Edit Documentation</DialogTitle>
        <DialogContent>
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            label="Documentation"
            minHeight={320}
          />
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

export default TemplateDocumentationField;
