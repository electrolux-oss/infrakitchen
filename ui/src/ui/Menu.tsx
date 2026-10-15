import {
  createContext,
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";

import { cn } from "../utils/cn";

import { Popover, PopoverProps } from "./Popover";

/** Set by Select so its MenuItems act as options. */
export interface MenuSelection {
  isSelected: (value: unknown) => boolean;
  select: (value: unknown, event: MouseEvent<HTMLElement>) => void;
}

export const MenuSelectionContext = createContext<MenuSelection | null>(null);

export interface MenuProps extends Omit<PopoverProps, "role"> {
  /** Classes for the list inside the surface. */
  listClassName?: string;
  /** ARIA role of the list: `menu` for actions, `listbox` for Select. */
  listRole?: "menu" | "listbox";
  "aria-labelledby"?: string;
}

const ITEM_SELECTOR =
  '[role="menuitem"]:not([aria-disabled="true"]), [role="option"]:not([aria-disabled="true"])';

/**
 * Dropdown menu: daisyUI `menu` list inside a Popover. Arrow keys, Home and End move between items, Tab closes, and the
 * selected item (or the first) takes focus on open.
 */
export function Menu({
  className,
  listClassName,
  listRole = "menu",
  children,
  onClose,
  open,
  "aria-labelledby": labelledBy,
  ...popover
}: MenuProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const target =
      list?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      list?.querySelector<HTMLElement>(ITEM_SELECTOR);
    target?.focus({ preventScroll: false });
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    if (event.key === "Tab") {
      event.preventDefault();
      onClose?.(event, "tabKeyDown");
      return;
    }
    const items = Array.from(list.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp")
      next = index <= 0 ? items.length - 1 : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    }
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      onKeyDown={onKeyDown}
      className={cn("mt-1 min-w-50", className)}
      {...popover}
    >
      <ul
        ref={listRef}
        role={listRole}
        aria-labelledby={labelledBy}
        className={cn(
          "d-menu m-0 w-full flex-nowrap gap-0 p-0 py-1 text-body2",
          listClassName,
        )}
      >
        {children}
      </ul>
    </Popover>
  );
}

export interface MenuItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "value"
> {
  /** Option value when used inside Select. */
  value?: unknown;
  disabled?: boolean;
  /** Marks the item as the current choice (Select sets this itself). */
  selected?: boolean;
}

/**
 * Menu row (a daisyUI `menu` item); inside Select it becomes an option for
 * `value`. Enter and Space activate it like a click.
 */
export const MenuItem = forwardRef<HTMLLIElement, MenuItemProps>(
  function MenuItem(
    {
      value,
      disabled = false,
      selected,
      className,
      onClick,
      onKeyDown,
      children,
      ...rest
    },
    ref,
  ) {
    const selection = useContext(MenuSelectionContext);
    const isOption = selection !== null;
    const isSelected = selected ?? (isOption && selection.isSelected(value));

    const activate = (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onClick?.(event);
      if (isOption) selection.select(value, event);
    };

    return (
      <li ref={ref} role="none" className="mx-1">
        <div
          role={isOption ? "option" : "menuitem"}
          tabIndex={disabled ? undefined : -1}
          aria-disabled={disabled || undefined}
          aria-selected={isOption ? isSelected : undefined}
          onClick={activate}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
          className={cn(
            "flex min-h-8 cursor-pointer flex-row items-center gap-0 rounded-surface px-4 py-1.5 text-body2 outline-none select-none",
            isSelected
              ? "bg-primary/8 hover:bg-primary/12 focus-visible:bg-primary/12"
              : "hover:bg-hover focus-visible:bg-hover",
            disabled && "pointer-events-none cursor-default opacity-40",
            className,
          )}
          {...rest}
        >
          {children}
        </div>
      </li>
    );
  },
);

export function ListItemIcon({
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "mr-3 inline-flex shrink-0 items-center text-fg-muted",
        className,
      )}
      {...rest}
    />
  );
}

export interface ListItemTextProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  primary?: ReactNode;
  secondary?: ReactNode;
  children?: ReactNode;
  primaryClassName?: string;
  secondaryClassName?: string;
}

export function ListItemText({
  primary,
  secondary,
  children,
  className,
  primaryClassName,
  secondaryClassName,
  ...rest
}: ListItemTextProps) {
  return (
    <div className={cn("my-1 min-w-0 flex-auto", className)} {...rest}>
      <span className={cn("block text-body2 font-medium", primaryClassName)}>
        {primary ?? children}
      </span>
      {secondary && (
        <span
          className={cn("block text-caption text-fg-muted", secondaryClassName)}
        >
          {secondary}
        </span>
      )}
    </div>
  );
}
