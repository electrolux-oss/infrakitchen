import { ElementType, forwardRef, HTMLAttributes, ReactNode } from "react";

import { cn } from "../utils/cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** `outlined` uses a white (dark: translucent) fill instead of paper. */
  variant?: "elevation" | "outlined";
  component?: ElementType;
}

/**
 * Bordered content card (daisyUI `card`): paper fill, divider border, 16px padding.
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { variant = "elevation", component: Component = "div", className, ...rest },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={cn(
        "d-card block overflow-hidden rounded-surface border border-divider bg-paper p-4 text-fg shadow-none transition-all duration-100",
        variant === "outlined" && "bg-white dark:bg-grey-900/40",
        className,
      )}
      {...rest}
    />
  );
});

export interface CardHeaderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: ReactNode;
  subheader?: ReactNode;
  /** Rendered at the end of the header row. */
  action?: ReactNode;
  avatar?: ReactNode;
  titleClassName?: string;
  subheaderClassName?: string;
}

export function CardHeader({
  title,
  subheader,
  action,
  avatar,
  className,
  titleClassName,
  subheaderClassName,
  ...rest
}: CardHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-center", className)} {...rest}>
      {avatar && <div className="mr-4 flex shrink-0">{avatar}</div>}
      <div className="min-w-0 flex-auto">
        {title && (
          <div
            className={cn(
              "d-card-title block text-[1.25rem] leading-[1.334] font-semibold",
              titleClassName,
            )}
          >
            {title}
          </div>
        )}
        {subheader && (
          <div
            className={cn("block text-body2 text-fg-muted", subheaderClassName)}
          >
            {subheader}
          </div>
        )}
      </div>
      {action && (
        <div className="-my-1 -mr-2 flex-none self-start">{action}</div>
      )}
    </div>
  );
}

export function CardContent({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-0 last:pb-3", className)} {...rest} />;
}

export function CardActions({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("d-card-actions flex items-center gap-2 p-0", className)}
      {...rest}
    />
  );
}
