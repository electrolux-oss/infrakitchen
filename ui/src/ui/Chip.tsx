import {
  CSSProperties,
  ElementType,
  forwardRef,
  HTMLAttributes,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";

import { CancelIcon } from "../icons/material";
import { cn } from "../utils/cn";

export type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

export interface ChipProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "color" | "onClick"
> {
  label?: ReactNode;
  color?: ChipColor;
  /** Only changes the `primary` color under the default appearance; the
   * other colors are tinted the same either way. */
  variant?: "filled" | "outlined";
  size?: "small" | "medium";
  /**
   * `theme` (default) is the tinted, rounded-corner chip. `solid` is the
   * filled pill badge (outlined in dark mode) and `soft` the translucent
   * pill.
   */
  appearance?: "theme" | "solid" | "soft";
  /** Smaller pill for dense rows; applies to `solid` and `soft`. */
  compact?: boolean;
  icon?: ReactElement;
  onDelete?: (event: MouseEvent<HTMLElement>) => void;
  deleteIcon?: ReactElement;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Adds hover feedback; implied by onClick. */
  clickable?: boolean;
  /** Element or component to render as, e.g. "a" or a router Link. */
  component?: ElementType;
  className?: string;
  labelClassName?: string;
  style?: CSSProperties;
  title?: string;
  /** Link props passed through to `component`. */
  href?: string;
  to?: string;
  target?: string;
  rel?: string;
}

type Tone = { theme: string; icon: string };

// Tints for the default (`theme`) appearance.
const THEME_TONES: Record<Exclude<ChipColor, "primary">, Tone> = {
  default: {
    theme:
      "border-grey-200 bg-grey-100 text-grey-500 dark:border-grey-700 dark:bg-grey-800 dark:text-grey-300",
    icon: "text-grey-500 dark:text-grey-300",
  },
  success: {
    theme:
      "border-tint-green-200 bg-tint-green-50 text-tint-green-500 dark:border-tint-green-800 dark:bg-tint-green-900 dark:text-tint-green-300",
    icon: "text-tint-green-500 dark:text-tint-green-300",
  },
  error: {
    theme:
      "border-tint-red-100 bg-tint-red-50 text-tint-red-500 dark:border-tint-red-800 dark:bg-tint-red-900 dark:text-tint-red-200",
    icon: "text-tint-red-500 dark:text-tint-red-300",
  },
  warning: {
    theme:
      "border-tint-orange-200 bg-tint-orange-50 text-tint-orange-500 dark:border-tint-orange-800 dark:bg-tint-orange-900 dark:text-tint-orange-300",
    icon: "text-tint-orange-500 dark:text-tint-orange-300",
  },
  info: {
    theme:
      "border-tint-blue-200 bg-tint-blue-50 text-tint-blue-500 dark:border-tint-blue-800 dark:bg-tint-blue-900 dark:text-tint-blue-300",
    icon: "text-tint-blue-500 dark:text-tint-blue-300",
  },
  secondary: {
    theme:
      "border-tint-purple-200 bg-tint-purple-50 text-tint-purple-500 dark:border-tint-purple-800 dark:bg-tint-purple-900 dark:text-tint-purple-300",
    icon: "text-tint-purple-500 dark:text-tint-purple-300",
  },
};

const PRIMARY = {
  filled: "border-primary bg-primary text-primary-contrast",
  outlined: "border-primary bg-transparent text-primary",
};

// Solid pills: filled with white text in light mode, outlined in dark mode
// where a solid fill blends into the surface.
const SOLID: Record<ChipColor, string> = {
  default:
    "bg-grey-400 text-white dark:border-grey-400/55 dark:bg-transparent dark:text-grey-400",
  primary:
    "bg-primary text-white dark:border-primary/55 dark:bg-transparent dark:text-primary",
  secondary:
    "bg-secondary text-white dark:border-secondary/55 dark:bg-transparent dark:text-secondary",
  success:
    "bg-success text-white dark:border-success/55 dark:bg-transparent dark:text-success",
  error:
    "bg-error text-white dark:border-error/55 dark:bg-transparent dark:text-error",
  warning:
    "bg-warning text-white dark:border-warning/55 dark:bg-transparent dark:text-warning",
  info: "bg-info text-white dark:border-info/55 dark:bg-transparent dark:text-info",
};

// Soft pills: translucent tint with the neutral chip label color.
const SOFT: Record<ChipColor, string> = {
  default: "border-grey-400/32 bg-grey-400/14",
  primary: "border-primary/32 bg-primary/14",
  secondary: "border-secondary/32 bg-secondary/14",
  success: "border-success/32 bg-success/14",
  error: "border-error/32 bg-error/14",
  warning: "border-warning/32 bg-warning/14",
  info: "border-info/32 bg-info/14",
};

/**
 * Compact label chip built on daisyUI's `badge`.
 */
export const Chip = forwardRef<HTMLElement, ChipProps>(function Chip(
  {
    label,
    color = "default",
    variant = "filled",
    size = "small",
    appearance = "theme",
    compact = false,
    icon,
    onDelete,
    deleteIcon,
    onClick,
    clickable,
    component,
    className,
    labelClassName,
    style,
    title,
    ...rest
  },
  ref,
) {
  const Component: ElementType = component ?? (onClick ? "button" : "div");
  const interactive = Boolean(onClick || clickable || component);
  const pill = appearance !== "theme";

  const toneClass = pill
    ? appearance === "solid"
      ? cn("border-transparent", SOLID[color])
      : cn(SOFT[color], "text-grey-500 dark:text-grey-300")
    : color === "primary"
      ? PRIMARY[variant]
      : THEME_TONES[color].theme;

  return (
    <Component
      ref={ref}
      title={title}
      style={style}
      onClick={onClick}
      type={Component === "button" ? "button" : undefined}
      className={cn(
        "d-badge inline-flex max-w-full shrink-0 items-center gap-0 border border-solid p-0 align-middle font-sans whitespace-nowrap",
        pill
          ? cn(
              "rounded-full text-[12px] leading-[1.2]",
              compact ? "h-4 tracking-[0.36px]" : "h-5 tracking-[0.6px]",
              appearance === "solid" ? "font-normal" : "font-semibold",
            )
          : cn(
              "rounded-surface text-caption font-semibold tracking-normal",
              size === "small" ? "h-5 max-h-5" : "h-8",
            ),
        toneClass,
        interactive &&
          "cursor-pointer no-underline transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/35",
        className,
      )}
      {...rest}
    >
      {icon && (
        <span
          className={cn(
            "-mr-1 ml-1 inline-flex [&_svg]:text-caption",
            !pill && color !== "primary" && THEME_TONES[color].icon,
          )}
        >
          {icon}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 overflow-hidden text-ellipsis",
          pill ? "px-2" : size === "small" ? "px-2" : "px-3",
          labelClassName,
        )}
      >
        {label}
      </span>
      {onDelete && (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Delete"
          className="mr-1 -ml-1 inline-flex cursor-pointer opacity-70 hover:opacity-100 [&_svg]:text-caption"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(event);
          }}
        >
          {deleteIcon ?? <CancelIcon />}
        </span>
      )}
    </Component>
  );
});
