import { useState } from "react";

import { EditAffordance } from "../../common/components/editors/EditAffordance";
import {
  CommonField,
  FieldSpan,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { MarkdownEditor } from "../../common/components/inputs/MarkdownEditor";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "../../ui";

export interface TemplateDocumentationFieldProps {
  /** Current documentation markdown, if any. */
  documentation: string | null | undefined;
  /** Whether the current user is allowed to edit the documentation. */
  canEdit: boolean;
  /** Persists the new documentation. Should throw on failure. */
  onSave: (documentation: string) => Promise<void>;
  /** Width in the surrounding field grid. */
  span?: FieldSpan;
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
  span = "half",
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
          <div
            // Reveal the edit affordance on hover/focus, like other fields.
            className="inline-flex max-w-full items-start [&:focus-within_.doc-edit-action]:opacity-100 [&:hover_.doc-edit-action]:opacity-100"
          >
            <div className="relative min-w-0">
              {documentation ? (
                <span>Documentation provided</span>
              ) : (
                <PlaceholderText />
              )}
              {/* Overlay the edit affordance just past the end of the value
                  text, vertically centered on it, so it never makes the value
                  row taller and the label-to-value gap stays consistent. */}
              <div className="absolute top-[50%] left-[100%] flex [transform:translateY(-50%)] items-center pl-1">
                <EditAffordance
                  className="doc-edit-action"
                  onClick={openDialog}
                  ariaLabel="Edit documentation"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        }
        span={span}
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
