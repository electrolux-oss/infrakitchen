import { CSSProperties } from "react";

import { cn } from "../utils/cn";

export interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  /** `primary` follows the theme's primary color, `inherit` the text color. */
  color?: "primary" | "inherit";
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

/** Indeterminate loading indicator (daisyUI `loading`). */
export function Spinner({
  size = 40,
  color = "primary",
  className,
  style,
  "aria-label": ariaLabel = "Loading",
}: SpinnerProps) {
  return (
    <span
      role="progressbar"
      aria-label={ariaLabel}
      className={cn(
        "d-loading shrink-0 d-loading-spinner",
        color === "primary" && "text-primary",
        className,
      )}
      style={{ width: size, ...style }}
    />
  );
}
