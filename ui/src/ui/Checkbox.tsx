import { forwardRef } from "react";

import { cn } from "../utils/cn";

import { SelectionControlProps, selectionInputProps } from "./selectionControl";

export type CheckboxProps = SelectionControlProps;

/**
 * daisyUI `checkbox`, drawn at 16px with an 8px margin so labels keep their
 * spacing.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...selectionInputProps(props)}
        className={cn(
          "d-checkbox m-2 rounded-[4px] border-grey-300 d-checkbox-xs d-checkbox-primary text-primary transition-colors checked:border-primary checked:bg-transparent hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 disabled:opacity-50 dark:border-divider dark:checked:border-primary",
          className,
        )}
      />
    );
  },
);
