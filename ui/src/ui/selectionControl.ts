import { ChangeEvent, InputHTMLAttributes } from "react";

/** Props shared by Checkbox and Switch. */
export interface SelectionControlProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size" | "type" | "value" | "color"
> {
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  size?: "small" | "medium";
  /** Only string and number values reach the input. react-hook-form spreads
   * the boolean field value here, which is ignored. */
  value?: unknown;
  /** Attributes for the native input. */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function selectionInputProps({
  onChange,
  value,
  inputProps,
  size: _size,
  ...rest
}: SelectionControlProps): InputHTMLAttributes<HTMLInputElement> {
  return {
    ...rest,
    ...inputProps,
    type: "checkbox",
    // A checked prop without onChange is a display-only or onClick-driven
    // control; readOnly keeps React from warning about it.
    readOnly: rest.readOnly ?? (rest.checked !== undefined && !onChange),
    value:
      typeof value === "string" || typeof value === "number"
        ? value
        : undefined,
    onChange: onChange
      ? (event: ChangeEvent<HTMLInputElement>) =>
          onChange(event, event.target.checked)
      : undefined,
  };
}
