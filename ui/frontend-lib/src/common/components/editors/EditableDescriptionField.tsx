import { GridSize, TextField } from "@mui/material";
import { ReactNode } from "react";

import { PlaceholderDescription } from "../PlaceholderDescription";
import { CommonEditableField } from "./CommonEditableField";

export interface EditableDescriptionFieldProps {
  /** Current persisted description (may be null/undefined). */
  value: string | null | undefined;
  /** Whether the current user is allowed to edit this field. */
  canEdit: boolean;
  /** Persists the new description; should throw on failure so it can be surfaced. */
  onSave: (description: string) => Promise<void>;
  /** Grid sizing for the underlying field cell (defaults to full width). */
  size?: GridSize | { xs: GridSize; md: GridSize } | undefined;
  /** Optional custom read-only rendering; overrides the default value/placeholder. */
  display?: ReactNode;
}

/**
 * Standard inline-editable "Description" field used on entity overview pages.
 * Renders the multiline description with a "No description" placeholder when
 * empty, and a click-to-edit multiline editor.
 */
export const EditableDescriptionField = ({
  value,
  canEdit,
  onSave,
  size = 12,
  display = value ? <span>{value}</span> : <PlaceholderDescription />,
}: EditableDescriptionFieldProps) => (
  <CommonEditableField<string>
    name="Description"
    canEdit={canEdit}
    value={value ?? ""}
    ariaLabel="Edit description"
    display={display}
    onSave={onSave}
    renderEditor={({ value, onChange }) => (
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{ input: { "aria-label": "Description" } }}
        fullWidth
        multiline
        minRows={2}
        margin="normal"
        autoFocus
      />
    )}
    size={size}
  />
);

export default EditableDescriptionField;
