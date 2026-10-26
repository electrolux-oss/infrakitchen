import {
  cloneElement,
  FocusEventHandler,
  isValidElement,
  MouseEventHandler,
  ReactElement,
  ReactNode,
} from "react";

import { cn } from "../utils/cn";

export interface FormControlLabelProps {
  /** The Checkbox, Switch or Radio the label belongs to. */
  control: ReactElement<{ disabled?: boolean }>;
  label: ReactNode;
  labelPlacement?: "end" | "start";
  /** Disables the control and greys out the label. */
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  onClick?: MouseEventHandler<HTMLLabelElement>;
  onFocus?: FocusEventHandler<HTMLLabelElement>;
}

/**
 * Clickable label around a selection control. The negative margin offsets
 * the control's own margin so the control lines up with surrounding text.
 */
export function FormControlLabel({
  control,
  label,
  labelPlacement = "end",
  disabled,
  className,
  labelClassName,
  onClick,
  onFocus,
}: FormControlLabelProps) {
  const isDisabled = disabled ?? control.props.disabled ?? false;
  const shownControl =
    disabled !== undefined && isValidElement(control)
      ? cloneElement(control, { disabled })
      : control;

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center align-middle select-none",
        labelPlacement === "start"
          ? "-mr-[11px] ml-4 flex-row-reverse"
          : "mr-4 -ml-[11px]",
        isDisabled && "cursor-default",
        className,
      )}
      onClick={onClick}
      onFocus={onFocus}
    >
      {shownControl}
      <span
        className={cn(
          "text-body2",
          isDisabled && "text-fg-disabled",
          labelClassName,
        )}
      >
        {label}
      </span>
    </label>
  );
}
