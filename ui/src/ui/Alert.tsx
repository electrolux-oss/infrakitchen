import { ReactNode } from "react";

import {
  CheckCircleOutlinedIcon,
  ErrorOutlineIcon,
  InfoOutlinedIcon,
  ReportProblemOutlinedIcon,
} from "../icons/material";
import { cn } from "../utils/cn";

export type AlertSeverity = "success" | "info" | "warning" | "error";

export interface AlertProps {
  severity?: AlertSeverity;
  /**
   * `standard` is a tinted panel, `outlined` keeps only the colored border,
   * `filled` uses the solid severity color.
   */
  variant?: "standard" | "outlined" | "filled";
  /** Replaces the severity icon; `false` hides it. */
  icon?: ReactNode | false;
  /** Rendered at the end of the row, e.g. a Button. */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const DEFAULT_ICONS: Record<AlertSeverity, ReactNode> = {
  success: <CheckCircleOutlinedIcon fontSize="inherit" />,
  info: <InfoOutlinedIcon fontSize="inherit" />,
  warning: <ReportProblemOutlinedIcon fontSize="inherit" />,
  error: <ErrorOutlineIcon fontSize="inherit" />,
};

// Full class names per tone so Tailwind can find them in the source.
const TONES: Record<
  AlertSeverity,
  { standard: string; outlined: string; filled: string; icon: string }
> = {
  success: {
    standard:
      "border-tint-green-300/50 bg-tint-green-100 dark:border-tint-green-800/50 dark:bg-tint-green-900/50",
    outlined: "border-success bg-transparent",
    filled: "border-success bg-success text-success-contrast",
    icon: "text-tint-green-500",
  },
  info: {
    standard:
      "border-tint-blue-300/50 bg-tint-blue-100 dark:border-tint-blue-800/50 dark:bg-tint-blue-900/50",
    outlined: "border-info bg-transparent",
    filled: "border-info bg-info text-info-contrast",
    icon: "text-tint-blue-500",
  },
  warning: {
    standard:
      "border-tint-orange-300/50 bg-tint-orange-100 dark:border-tint-orange-800/50 dark:bg-tint-orange-900/50",
    outlined: "border-warning bg-transparent",
    filled: "border-warning bg-warning text-warning-contrast",
    icon: "text-tint-orange-500",
  },
  error: {
    standard:
      "border-tint-red-300/50 bg-tint-red-100 dark:border-tint-red-800/50 dark:bg-tint-red-900/50",
    outlined: "border-error bg-transparent",
    filled: "border-error bg-error text-error-contrast",
    icon: "text-tint-red-400",
  },
};

/**
 * Inline status message built on daisyUI's `alert`, toned by `severity`
 * and `variant`, with an optional `icon` and `action`.
 */
export function Alert({
  severity = "success",
  variant = "standard",
  icon,
  action,
  className,
  children,
}: AlertProps) {
  const tone = TONES[severity];
  const shownIcon = icon === undefined ? DEFAULT_ICONS[severity] : icon;

  return (
    <div
      role="alert"
      className={cn(
        "d-alert flex items-start gap-3 rounded-surface px-4 py-1.5 text-body2 text-fg",
        tone[variant],
        className,
      )}
    >
      {shownIcon !== false && shownIcon !== null && (
        <span
          className={cn(
            "flex shrink-0 py-[7px] text-[22px]",
            variant === "filled" ? "text-inherit" : tone.icon,
          )}
        >
          {shownIcon}
        </span>
      )}
      <div className="min-w-0 flex-1 overflow-auto py-2">{children}</div>
      {action && (
        <div className="-mr-2 ml-auto flex shrink-0 items-center self-center pl-4">
          {action}
        </div>
      )}
    </div>
  );
}

export interface AlertTitleProps {
  className?: string;
  children?: ReactNode;
}

export function AlertTitle({ className, children }: AlertTitleProps) {
  return (
    <div className={cn("-mt-0.5 mb-1 text-body2 font-semibold", className)}>
      {children}
    </div>
  );
}
