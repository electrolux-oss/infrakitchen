import { forwardRef } from "react";

import { cn } from "../utils/cn";

import { SelectionControlProps, selectionInputProps } from "./selectionControl";

export type SwitchProps = SelectionControlProps;

/**
 * daisyUI `toggle`. Small (the default) and medium reserve a fixed
 * footprint, so rows don't shift.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, size = "small", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      role="switch"
      {...selectionInputProps(props)}
      className={cn(
        "d-toggle rounded-full d-toggle-primary before:rounded-full",
        size === "small"
          ? "mx-[3.5px] my-0.5 d-toggle-sm"
          : "mx-[9px] my-[7px]",
        className,
      )}
    />
  );
});
