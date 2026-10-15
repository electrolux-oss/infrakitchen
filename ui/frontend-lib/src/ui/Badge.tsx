import { ReactNode } from "react";

import { cn } from "../utils/cn";

export interface BadgeProps {
  badgeContent?: ReactNode;
  color?: "primary" | "error" | "warning" | "success" | "info";
  /** Cap numeric content, showing e.g. "99+". */
  max?: number;
  /** A small dot instead of content. */
  variant?: "standard" | "dot";
  invisible?: boolean;
  /** Show a zero count instead of hiding it. */
  showZero?: boolean;
  className?: string;
  children?: ReactNode;
}

const BADGE_COLORS = {
  primary: "bg-primary text-primary-contrast",
  error: "bg-error text-error-contrast",
  warning: "bg-warning text-warning-contrast",
  success: "bg-success text-success-contrast",
  info: "bg-info text-info-contrast",
};

/** Count or dot on a child's corner (daisyUI `indicator` + `badge`). */
export function Badge({
  badgeContent,
  color = "primary",
  max = 99,
  variant = "standard",
  invisible,
  showZero = false,
  className,
  children,
}: BadgeProps) {
  const hidden =
    invisible ??
    (variant === "standard" &&
      (badgeContent === undefined ||
        badgeContent === null ||
        (badgeContent === 0 && !showZero)));
  const content =
    typeof badgeContent === "number" && badgeContent > max
      ? `${max}+`
      : badgeContent;
  return (
    <span className={cn("d-indicator", className)}>
      {!hidden && (
        <span
          className={cn(
            "d-indicator-item d-badge border-0 font-sans font-medium",
            BADGE_COLORS[color],
            variant === "dot"
              ? "size-2 min-w-0 p-0"
              : "h-5 min-w-5 rounded-full px-1.5 text-[0.75rem] leading-none",
          )}
        >
          {variant === "dot" ? null : content}
        </span>
      )}
      {children}
    </span>
  );
}
