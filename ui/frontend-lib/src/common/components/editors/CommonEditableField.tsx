import { ReactNode } from "react";

import { GridSize } from "@mui/material";

import { CommonField } from "../CommonField";

import { InlineEditableField } from "./InlineEditableField";

export interface CommonEditableFieldProps<T> {
  /** Field label shown above the value. */
  name: string;
  /** Grid sizing for the underlying field cell. */
  size?: GridSize | { xs: GridSize; md: GridSize } | undefined;
  /** Whether the current user is allowed to edit this field. */
  canEdit: boolean;
  /** Tooltip shown on the disabled edit icon when the user lacks permission. */
  disabledTooltip?: string;
  /** Current persisted value. */
  value: T;
  /** Read-only rendering shown when not editing. */
  display: ReactNode;
  /**
   * Persists the new value. Should throw on failure so the editor stays open;
   * the caller is responsible for surfacing the error to the user.
   */
  onSave: (value: T) => Promise<void>;
  /** Renders the type-specific editor while in edit mode. */
  renderEditor: (args: { value: T; onChange: (value: T) => void }) => ReactNode;
  /** Optional custom equality check to detect changes for complex values. */
  isEqual?: (a: T, b: T) => boolean;
  /** Accessible label for the edit affordance. */
  ariaLabel?: string;
  /** Placeholder shown when there is no value to display. */
  placeholder?: string;
  /** Optional hook called when edit mode is opened. */
  onEditStart?: () => void;
}

/**
 * Labeled field with built-in click-to-edit behaviour. Combines `CommonField`
 * for the label/layout with `InlineEditableField` for the editing affordance,
 * so callers only need to describe the value, its display, and its editor.
 */
export function CommonEditableField<T>({
  name,
  size,
  canEdit,
  disabledTooltip,
  value,
  display,
  onSave,
  renderEditor,
  isEqual,
  ariaLabel,
  placeholder,
  onEditStart,
}: CommonEditableFieldProps<T>) {
  return (
    <CommonField
      name={name}
      size={size}
      value={
        <InlineEditableField<T>
          value={value}
          display={display}
          canEdit={canEdit}
          disabledTooltip={disabledTooltip}
          onSave={onSave}
          renderEditor={renderEditor}
          isEqual={isEqual}
          ariaLabel={ariaLabel}
          placeholder={placeholder}
          onEditStart={onEditStart}
        />
      }
    />
  );
}

export default CommonEditableField;
