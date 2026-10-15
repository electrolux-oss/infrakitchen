import {
  Children,
  cloneElement,
  HTMLAttributes,
  isValidElement,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  SyntheticEvent,
} from "react";

import { cn } from "../utils/cn";

export interface TabProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  label?: ReactNode;
  value?: unknown;
  disabled?: boolean;
  /** Set by Tabs. */
  selected?: boolean;
  /** Set by Tabs. */
  fullWidth?: boolean;
  /** Set by Tabs. */
  onTabSelect?: (event: SyntheticEvent, value: unknown) => void;
}

/** One tab of a Tabs bar (daisyUI `tab`). */
export function Tab({
  label,
  value,
  disabled = false,
  selected = false,
  fullWidth = false,
  onTabSelect,
  className,
  onClick,
  ...rest
}: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled) onTabSelect?.(event, value);
      }}
      className={cn(
        "d-tab relative h-auto min-h-12 max-w-[360px] min-w-[90px] shrink-0 border-0 bg-transparent px-4 py-3 font-sans text-body2 leading-[1.25] font-medium text-fg-muted normal-case transition-colors",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity",
        selected && "text-primary after:opacity-100",
        disabled && "opacity-38",
        fullWidth && "max-w-none flex-1",
        className,
      )}
      {...rest}
    >
      {label}
    </button>
  );
}

export interface TabsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  value: unknown;
  onChange?: (event: SyntheticEvent, value: never) => void;
  /** `fullWidth` stretches tabs to fill the bar. */
  variant?: "standard" | "fullWidth" | "scrollable";
  /** Hide the active-tab underline (segmented tab styles). */
  hideIndicator?: boolean;
}

/**
 * Tab bar (daisyUI `tabs`): an underline marks the
 * selected tab; arrow keys move between tabs.
 */
export function Tabs({
  value,
  onChange,
  variant = "standard",
  hideIndicator = false,
  className,
  children,
  ...rest
}: TabsProps) {
  const tabs = Children.toArray(children).filter(isValidElement);
  const fullWidth = variant === "fullWidth";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
    buttons[next].click();
  };

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        "d-tabs flex min-h-12 flex-nowrap overflow-x-auto overflow-y-hidden bg-transparent",
        hideIndicator && "[&>[role=tab]]:after:hidden",
        className,
      )}
      {...rest}
    >
      {tabs.map((child, index) => {
        const tab = child as ReactElement<TabProps>;
        const tabValue = tab.props.value ?? index;
        return cloneElement(tab, {
          key: tab.key ?? index,
          value: tabValue,
          selected: tabValue === value,
          fullWidth,
          onTabSelect: (event: SyntheticEvent, v: unknown) =>
            onChange?.(event, v as never),
        });
      })}
    </div>
  );
}
