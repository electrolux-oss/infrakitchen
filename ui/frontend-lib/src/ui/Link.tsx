import { AnchorHTMLAttributes, ElementType, forwardRef } from "react";

import { cn } from "../utils/cn";

const VARIANTS = {
  inherit: "",
  body1: "text-body1",
  body2: "text-body2",
  caption: "text-caption",
  subtitle1: "text-subtitle1",
  subtitle2: "text-subtitle2",
  h6: "text-h6",
};

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Element or component to render, e.g. a router Link or "button". */
  component?: ElementType;
  /** Router destination when `component` is a router Link. */
  to?: string;
  /** The underline shows on hover unless `none`. */
  underline?: "hover" | "none";
  variant?: keyof typeof VARIANTS;
  /** `inherit` keeps the surrounding text color. */
  color?: "inherit" | "primary";
}

/**
 * Text link (daisyUI `link`): link color, underline appearing on hover, focus ring.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    component: Component = "a",
    underline = "hover",
    variant = "inherit",
    color,
    className,
    ...rest
  },
  ref,
) {
  return (
    <Component
      ref={ref}
      type={Component === "button" ? "button" : undefined}
      className={cn(
        "d-link underline decoration-transparent transition-[color,text-decoration-color] duration-200",
        "hover:text-link-hover hover:decoration-link-hover focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link/30",
        color === "inherit" ? "text-inherit" : "text-link",
        underline === "none" && "hover:decoration-transparent",
        Component === "button" &&
          "cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit]",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});
