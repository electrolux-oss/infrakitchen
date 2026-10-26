import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  forwardRef,
  Ref,
} from "react";

import { cn } from "../utils/cn";

import { BUTTON_BASE } from "./Button";

export interface IconButtonOwnProps {
  size?: "small" | "medium";
  /** Pulls the button outwards so the icon lines up with the edge. */
  edge?: "start" | "end" | false;
}

export type IconButtonProps = IconButtonOwnProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Renders an anchor instead of a button. */
    href?: string;
    target?: AnchorHTMLAttributes<HTMLAnchorElement>["target"];
    rel?: string;
  };

/**
 * Square ghost button for a single icon (daisyUI `btn` + `btn-square`) in
 * the muted text color. Small (the default) is 36px with a 16px
 * icon; medium is 40px with a 24px icon.
 */
export const IconButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  IconButtonProps
>(function IconButton(
  {
    size = "small",
    edge = false,
    className,
    href,
    target,
    rel,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  const classes = cn(
    BUTTON_BASE,
    "d-btn-square min-h-0 border-0 bg-transparent p-1 hover:bg-hover active:bg-selected disabled:bg-transparent disabled:text-disabled",
    size === "small" ? "size-9 [&_svg]:text-base" : "size-10 p-2",
    "text-fg-muted",
    edge === "end" && (size === "small" ? "-mr-[3px]" : "-mr-3"),
    edge === "start" && (size === "small" ? "-ml-[3px]" : "-ml-3"),
    className,
  );

  if (href !== undefined) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        target={target}
        rel={rel}
        className={classes}
        aria-label={rest["aria-label"]}
        title={rest.title}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
});
