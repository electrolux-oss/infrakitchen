import {
  cloneElement,
  ElementType,
  forwardRef,
  HTMLAttributes,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";

import { cn } from "../utils/cn";

export type LabelTone =
  | "default"
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "error";

export type LabelSize = "small" | "medium" | "large";
export type LabelCase = "none" | "uppercase";

export interface LabelProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "color" | "onClick"
> {
  label?: ReactNode;
  tone?: LabelTone;
  /** Defaults to medium. */
  size?: LabelSize;
  case?: LabelCase;
  icon?: ReactElement<{ fontSize?: string; className?: string }>;
  /** Optional trailing content, such as an input-specific control. */
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  clickable?: boolean;
  component?: ElementType;
  labelClassName?: string;
  href?: string;
  to?: string;
  target?: string;
  rel?: string;
}

const toneClasses: Record<LabelTone, string> = {
  default: "bg-grey-200 text-grey-600 dark:bg-grey-800 dark:text-grey-300",
  primary: "bg-primary/10 text-primary dark:bg-primary/30 dark:text-primary",
  secondary:
    "bg-secondary/10 text-secondary dark:bg-secondary/30 dark:text-secondary",
  info: "bg-tint-blue-100 text-tint-blue-500 dark:bg-tint-blue-700 dark:text-tint-blue-300",
  success:
    "bg-tint-green-100 text-tint-green-500 dark:bg-tint-green-700 dark:text-tint-green-300",
  warning:
    "bg-tint-orange-100 text-tint-orange-500 dark:bg-tint-orange-700 dark:text-tint-orange-300",
  error:
    "bg-tint-red-100 text-tint-red-500 dark:bg-tint-red-700 dark:text-tint-red-300",
};

const sizeClasses: Record<LabelSize, string> = {
  small: "h-5 text-[0.6875rem]",
  medium: "h-5 text-[0.8125rem]",
  large: "h-7.5 text-sm",
};

/** The shared pill for metadata, counts, statuses and selected input values. */
export const Label = forwardRef<HTMLElement, LabelProps>(function Label(
  {
    label,
    tone = "default",
    size = "medium",
    case: labelCase = "none",
    icon,
    children,
    onClick,
    clickable,
    component,
    className,
    labelClassName,
    ...rest
  },
  ref,
) {
  const Component: ElementType = component ?? (onClick ? "button" : "span");
  const interactive = Boolean(onClick || clickable || component);
  // Respect explicit icon sizing; otherwise scale with the label's text.
  const hasIconSize =
    icon?.props.fontSize !== undefined ||
    /(?:^|\s)(?:text-|size-|h-|w-)/.test(icon?.props.className ?? "");

  return (
    <Component
      ref={ref}
      type={Component === "button" ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full min-w-5 shrink-0 items-center justify-center gap-0 rounded-full border border-solid border-transparent p-0 align-middle font-sans leading-none font-semibold tracking-normal whitespace-nowrap",
        sizeClasses[size],
        toneClasses[tone],
        labelCase === "uppercase" && "uppercase",
        interactive &&
          "cursor-pointer no-underline transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/35",
        className,
      )}
      {...rest}
    >
      {icon && (
        <span className="-mr-1 ml-1 inline-flex text-[1.25em]">
          {hasIconSize ? icon : cloneElement(icon, { fontSize: "inherit" })}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 overflow-hidden px-1.5 text-ellipsis",
          labelClassName,
        )}
      >
        {label}
      </span>
      {children}
    </Component>
  );
});
