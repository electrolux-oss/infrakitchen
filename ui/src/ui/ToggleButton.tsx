import {
  ButtonHTMLAttributes,
  createContext,
  HTMLAttributes,
  MouseEvent,
  useContext,
} from "react";

import { cn } from "../utils/cn";

import { BUTTON_BASE } from "./Button";

interface ToggleGroupState {
  value: unknown;
  select: (event: MouseEvent<HTMLButtonElement>, value: unknown) => void;
  size: "small" | "medium";
  fullWidth: boolean;
}

const ToggleGroupContext = createContext<ToggleGroupState | null>(null);

export interface ToggleButtonGroupProps<T = unknown> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  value: T | T[] | null;
  /** Single choice; otherwise values toggle in an array. */
  exclusive?: boolean;
  onChange?: (event: MouseEvent<HTMLButtonElement>, value: T) => void;
  size?: "small" | "medium";
  fullWidth?: boolean;
}

/** Segmented control (daisyUI `join`). */
export function ToggleButtonGroup<T = unknown>({
  value,
  exclusive = false,
  onChange,
  size = "medium",
  fullWidth = false,
  className,
  children,
  ...rest
}: ToggleButtonGroupProps<T>) {
  const select = (event: MouseEvent<HTMLButtonElement>, next: unknown) => {
    if (exclusive) {
      onChange?.(event, (value === next ? null : next) as T);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    onChange?.(
      event,
      (current.includes(next as T)
        ? current.filter((v) => v !== next)
        : [...current, next]) as T,
    );
  };
  return (
    <ToggleGroupContext.Provider value={{ value, select, size, fullWidth }}>
      <div
        role="group"
        className={cn(
          "d-join rounded-surface",
          fullWidth && "flex w-full",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> {
  value: unknown;
  selected?: boolean;
}

export function ToggleButton({
  value,
  selected,
  className,
  onClick,
  ...rest
}: ToggleButtonProps) {
  const group = useContext(ToggleGroupContext);
  const isSelected =
    selected ??
    (Array.isArray(group?.value)
      ? group.value.includes(value)
      : group?.value === value);
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={(event) => {
        onClick?.(event);
        group?.select(event, value);
      }}
      className={cn(
        BUTTON_BASE,
        "d-join-item h-auto min-h-0 border border-divider bg-transparent font-medium text-fg-muted hover:bg-hover dark:text-grey-300",
        // Both sizes share the 12px 16px padding; only the text size differs.
        group?.size === "small"
          ? "px-4 py-3 text-[0.8125rem]"
          : "px-4 py-3 text-body2",
        isSelected &&
          "bg-selected text-grey-900 hover:bg-selected dark:text-grey-50",
        group?.fullWidth && "flex-1",
        className,
      )}
      {...rest}
    />
  );
}
