import { HTMLAttributes } from "react";

import { cn } from "../utils/cn";

export interface CollapseProps extends HTMLAttributes<HTMLDivElement> {
  in: boolean;
  /** Remove the children from the DOM while collapsed. */
  unmountOnExit?: boolean;
}

/** Height transition between collapsed and expanded (grid-rows trick). */
export function Collapse({
  in: open,
  unmountOnExit = false,
  className,
  children,
  ...rest
}: CollapseProps) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-in-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
      aria-hidden={!open || undefined}
      {...rest}
    >
      <div className="min-h-0 overflow-hidden">
        {open || !unmountOnExit ? children : null}
      </div>
    </div>
  );
}
