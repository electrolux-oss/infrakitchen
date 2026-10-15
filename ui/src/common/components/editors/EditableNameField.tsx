import { ReactNode } from "react";

import { TextField } from "../../../ui";
import { FieldSpan } from "../fields/CommonField";

import { CommonEditableField } from "./CommonEditableField";

export interface EditableNameFieldProps {
  /** Current persisted name. */
  value: string;
  /** Whether the current user is allowed to edit this field. */
  canEdit: boolean;
  /** Persists the new name; should throw on failure so it can be surfaced. */
  onSave: (name: string) => Promise<void>;
  /** Width in the surrounding field grid (defaults to full). */
  span?: FieldSpan;
  /** Optional custom read-only rendering; defaults to the name. */
  display?: ReactNode;
}

/** Standard inline-editable "Name" field used on entity detail pages. */
export const EditableNameField = ({
  value,
  canEdit,
  onSave,
  span = "full",
  display = <span>{value}</span>,
}: EditableNameFieldProps) => (
  <CommonEditableField<string>
    name="Name"
    canEdit={canEdit}
    value={value}
    ariaLabel="Edit name"
    display={display}
    onSave={onSave}
    renderEditor={({ value, onChange }) => (
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Name"
        fullWidth
        margin="normal"
        autoFocus
      />
    )}
    span={span}
  />
);
