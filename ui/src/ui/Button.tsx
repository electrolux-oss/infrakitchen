import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

import { cn } from "../utils/cn";

import { Spinner } from "./Spinner";

export type ButtonColor =
  | "primary"
  | "secondary"
  | "error"
  | "warning"
  | "success"
  | "info"
  | "inherit";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `outlined` (default) is the neutral pill, `contained` the solid action
   * button, `text` a borderless link-like button. */
  variant?: "outlined" | "contained" | "text";
  /** Only changes `contained` buttons; outlined and text stay neutral. */
  color?: ButtonColor;
  size?: "small" | "medium";
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  fullWidth?: boolean;
  /** Shows a spinner over the label and disables the button. */
  loading?: boolean;
}

const CONTAINED: Record<ButtonColor, string> = {
  primary:
    "border-transparent bg-grey-900 text-white hover:bg-[#202020] active:bg-grey-800 dark:bg-grey-50 dark:text-grey-900 dark:hover:bg-[#ededed] dark:active:bg-grey-300",
  secondary:
    "border-transparent bg-grey-900 text-white hover:bg-[#202020] active:bg-grey-800 dark:bg-grey-50 dark:text-grey-900 dark:hover:bg-[#ededed] dark:active:bg-grey-300",
  error:
    "border-transparent bg-error text-white hover:bg-error-dark active:bg-error dark:bg-error-dark dark:hover:bg-error dark:active:bg-error-dark",
  warning:
    "border-transparent bg-warning text-warning-contrast hover:bg-warning-dark",
  success:
    "border-transparent bg-success text-success-contrast hover:bg-success-dark",
  info: "border-transparent bg-info text-info-contrast hover:bg-info-dark",
  inherit:
    "border-transparent bg-grey-300 text-grey-900 hover:bg-grey-200 dark:bg-grey-700 dark:text-grey-50",
};

const OUTLINED =
  "border-grey-300 bg-paper text-fg hover:border-grey-400 hover:bg-grey-100 active:bg-grey-200 dark:border-grey-600 dark:bg-transparent dark:hover:border-grey-500 dark:hover:bg-grey-100/8 dark:active:bg-grey-100/14";

const TEXT =
  "border-transparent bg-transparent text-grey-600 hover:bg-grey-100 active:bg-grey-200 dark:text-grey-300 dark:hover:bg-grey-100/8 dark:active:bg-grey-100/14";

const TEXT_SECONDARY =
  "border-transparent bg-transparent text-grey-700 hover:bg-grey-100 active:bg-grey-200 dark:text-grey-200 dark:hover:bg-grey-100/8 dark:active:bg-grey-100/14";

/** Classes shared by every daisyUI-backed button. */
export const BUTTON_BASE =
  "d-btn shrink-0 gap-0 rounded-surface font-sans font-medium normal-case shadow-none transition-all duration-100 ease-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/35";

function buttonClasses({
  variant = "outlined",
  color = "primary",
  size = "small",
  fullWidth,
}: Pick<ButtonProps, "variant" | "color" | "size" | "fullWidth">): string {
  return cn(
    BUTTON_BASE,
    size === "small"
      ? "h-9 min-h-9 min-w-16 px-3 py-2 text-body2 leading-[1.75]"
      : "h-10 min-h-10 min-w-16 px-4 py-1.5 text-body2 leading-[1.75]",
    variant === "contained"
      ? CONTAINED[color]
      : variant === "text"
        ? color === "secondary"
          ? TEXT_SECONDARY
          : TEXT
        : OUTLINED,
    variant === "contained"
      ? "disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled"
      : variant === "outlined"
        ? "disabled:border-disabled-bg disabled:bg-transparent disabled:text-disabled"
        : "disabled:bg-transparent disabled:text-disabled",
    fullWidth && "w-full",
  );
}

/**
 * daisyUI `btn`; defaults to small and outlined.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant,
      color,
      size = "small",
      startIcon,
      endIcon,
      fullWidth,
      className,
      type = "button",
      loading = false,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    const iconSize =
      size === "small" ? "[&_svg]:text-[18px]" : "[&_svg]:text-[20px]";
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          buttonClasses({ variant, color, size, fullWidth }),
          loading && "relative [&>:not(.d-loading)]:invisible",
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && (
          <Spinner
            size={16}
            color="inherit"
            className="absolute inset-0 m-auto"
          />
        )}
        {startIcon && (
          <span
            className={cn(
              "mr-2 inline-flex",
              size === "small" ? "-ml-0.5" : "-ml-1",
              iconSize,
            )}
          >
            {startIcon}
          </span>
        )}
        {loading ? <span className="invisible">{children}</span> : children}
        {endIcon && (
          <span
            className={cn(
              "ml-2 inline-flex",
              size === "small" ? "-mr-0.5" : "-mr-1",
              iconSize,
            )}
          >
            {endIcon}
          </span>
        )}
      </button>
    );
  },
);
