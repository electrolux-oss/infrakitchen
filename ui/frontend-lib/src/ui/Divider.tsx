import { HTMLAttributes } from "react";

import { cn } from "../utils/cn";

export type DividerProps = HTMLAttributes<HTMLHRElement>;

/**
 * Thin horizontal rule in the theme's divider color (daisyUI's `divider` is
 * a spaced, labelled separator instead).
 */
export function Divider({ className, ...rest }: DividerProps) {
  return (
    <hr
      className={cn("m-0 shrink-0 border-0 border-b border-divider", className)}
      {...rest}
    />
  );
}
