import { forwardRef } from "react";

import { cn } from "../utils/cn";

import { SelectionControlProps, selectionInputProps } from "./selectionControl";

export type CheckboxProps = SelectionControlProps;

/**
 * daisyUI `checkbox`, drawn at 20px with a 10px margin so labels keep their
 * spacing.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...selectionInputProps(props)}
        className={cn(
          "d-checkbox m-2.5 rounded-[5px] border-grey-300 d-checkbox-sm d-checkbox-primary checked:border-primary dark:border-divider dark:checked:border-primary",
          className,
        )}
      />
    );
  },
);
