import { Switch } from "../../../ui";
import { CommonField, FieldSpan } from "../fields/CommonField";

export interface BooleanInlineFieldProps {
  /** Field label shown above the value. */
  name: string;
  /** Whether the current user is allowed to edit this field. */
  canEdit: boolean;
  /** Current persisted value. */
  value: boolean;
  /** Width in the surrounding field grid. */
  span?: FieldSpan;
  /** Accessible label for the toggle (defaults to the field name). */
  ariaLabel?: string;
  /** Persists the new value; should throw on failure so it can be surfaced. */
  onSave: (next: boolean) => Promise<void>;
}

/**
 * Boolean field rendered as a directly-toggleable switch that persists
 * immediately on change — no click-to-edit or save/cancel flow, mirroring the
 * feature-flag toggle pattern.
 */
export const BooleanInlineField = ({
  name,
  canEdit,
  value,
  span,
  ariaLabel,
  onSave,
}: BooleanInlineFieldProps) => {
  const handleChange = async (next: boolean) => {
    try {
      await onSave(next);
    } catch {
      // onSave already surfaces the error; the toggle returns to reflecting the
      // persisted value once the entity refreshes.
    }
  };

  return (
    <CommonField
      name={name}
      span={span}
      value={
        <Switch
          className="mt-1"
          checked={value}
          disabled={!canEdit}
          onChange={(e) => handleChange(e.target.checked)}
          inputProps={{ "aria-label": ariaLabel || name }}
        />
      }
    />
  );
};
