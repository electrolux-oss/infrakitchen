import { forwardRef, memo, SVGProps } from "react";

import type { IconifyIcon } from "@iconify/react";

import { cn } from "../utils/cn";

const FONT_SIZES = {
  inherit: "text-inherit",
  small: "text-[1.25rem]",
  medium: "text-[1.5rem]",
  large: "text-[2.1875rem]",
};

const COLORS: Record<string, string> = {
  inherit: "",
  action: "text-action-active",
  disabled: "text-fg-disabled",
  primary: "text-primary",
  secondary: "text-secondary",
  error: "text-error",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
};

export interface IconProps extends Omit<
  SVGProps<SVGSVGElement>,
  "ref" | "color"
> {
  /** 20px small, 24px medium (default), 35px large, or the parent's size. */
  fontSize?: keyof typeof FONT_SIZES;
  /** Palette color name; defaults to the current text color. */
  color?: keyof typeof COLORS | string;
  /** Accessible label; without it the icon is hidden from screen readers. */
  titleAccess?: string;
}

export type IconComponent = ReturnType<typeof createIcon>;

/**
 * Turns bundled Iconify icon data into an icon component (fontSize, color,
 * titleAccess). Icons are 1em squares in the current text color.
 */
export function createIcon(data: IconifyIcon, name: string) {
  const viewBox = `${data.left ?? 0} ${data.top ?? 0} ${data.width ?? 16} ${
    data.height ?? 16
  }`;
  const Icon = memo(
    forwardRef<SVGSVGElement, IconProps>(function Icon(
      { fontSize = "medium", color, titleAccess, className, children, ...rest },
      ref,
    ) {
      return (
        <svg
          ref={ref}
          data-testid={`${name}Icon`}
          viewBox={viewBox}
          focusable="false"
          aria-hidden={titleAccess ? undefined : true}
          role={titleAccess ? "img" : undefined}
          className={cn(
            "inline-block size-[1em] shrink-0 fill-current transition-[fill] duration-200 select-none",
            FONT_SIZES[fontSize],
            color && COLORS[color],
            className,
          )}
          {...rest}
        >
          {titleAccess ? <title>{titleAccess}</title> : null}
          {/* Icon bodies are static SVG markup from the @iconify-icons packages. */}
          <g dangerouslySetInnerHTML={{ __html: data.body }} />
          {children}
        </svg>
      );
    }),
  );
  Icon.displayName = `${name}Icon`;
  return Icon;
}
