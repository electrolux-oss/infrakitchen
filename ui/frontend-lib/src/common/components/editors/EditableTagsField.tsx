import { GridSize } from "@mui/material";
import { ReactNode } from "react";

import { sameStringSet } from "../../utils";
import { Labels } from "../Labels";
import { CommonEditableField } from "./CommonEditableField";
import { StringTagEditor } from "./StringTagEditor";

export interface EditableTagsFieldProps {
  /** Field caption; defaults to "Labels". */
  name?: string;
  /** Current persisted labels/tags. */
  value: string[];
  /** Whether the current user can edit this field. */
  canEdit: boolean;
  /** Persists the new labels; should throw on failure so it can be surfaced. */
  onSave: (labels: string[]) => Promise<void>;
  /** Accessible label for the editor input; defaults to the field name. */
  editorLabel?: string;
  /** Helper text shown under the editor. */
  helperText?: string;
  /** Grid sizing for the underlying field cell (defaults to full width). */
  size?: GridSize | { xs: GridSize; md: GridSize } | undefined;
  /** Optional custom read-only rendering; overrides the default chip list. */
  display?: ReactNode;
}

/**
 * Standard inline-editable tags/labels field used on overview pages. Renders
 * labels as chips (with the "Not set" placeholder when empty) and a click-to-edit
 * tag editor.
 */
export const EditableTagsField = ({
  name = "Labels",
  value,
  canEdit,
  onSave,
  editorLabel,
  helperText = "Press Enter to add a label",
  size = 12,
  display = <Labels labels={value} />,
}: EditableTagsFieldProps) => (
  <CommonEditableField<string[]>
    name={name}
    canEdit={canEdit}
    value={value}
    ariaLabel={`Edit ${name.toLowerCase()}`}
    isEqual={sameStringSet}
    display={display}
    onSave={onSave}
    renderEditor={({ value, onChange }) => (
      <StringTagEditor
        value={value}
        onChange={onChange}
        label={editorLabel ?? name}
        helperText={helperText}
      />
    )}
    size={size}
  />
);

export default EditableTagsField;
