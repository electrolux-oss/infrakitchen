import {
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  LiHTMLAttributes,
} from "react";

import { cn } from "../utils/cn";

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  dense?: boolean;
  disablePadding?: boolean;
}

/** Vertical list (daisyUI `list`). */
export function List({
  dense: _dense,
  disablePadding = false,
  className,
  ...rest
}: ListProps) {
  return (
    <ul
      className={cn(
        "d-list m-0 flex list-none flex-col gap-0 rounded-none",
        disablePadding ? "p-0" : "p-2",
        className,
      )}
      {...rest}
    />
  );
}

export interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  dense?: boolean;
  disablePadding?: boolean;
  disableGutters?: boolean;
}

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
  function ListItem(
    {
      dense,
      disablePadding = false,
      disableGutters = false,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <li
        ref={ref}
        className={cn(
          "relative flex w-full items-center text-left",
          !disablePadding && (dense ? "py-1" : "py-2"),
          !disablePadding && !disableGutters && "px-4",
          className,
        )}
        {...rest}
      />
    );
  },
);

export interface ListItemButtonProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  disabled?: boolean;
  dense?: boolean;
  alignItems?: "center" | "flex-start";
}

/** Clickable list row; Enter and Space activate it. */
export const ListItemButton = forwardRef<HTMLDivElement, ListItemButtonProps>(
  function ListItemButton(
    {
      selected = false,
      disabled = false,
      dense = false,
      alignItems = "center",
      className,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-selected={selected || undefined}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(event);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        className={cn(
          "flex min-w-0 grow cursor-pointer px-4 text-left outline-none hover:bg-hover focus-visible:bg-hover",
          dense ? "py-1" : "py-2",
          alignItems === "flex-start" ? "items-start" : "items-center",
          selected && "bg-selected hover:bg-selected",
          disabled && "pointer-events-none opacity-40",
          className,
        )}
        {...rest}
      />
    );
  },
);
