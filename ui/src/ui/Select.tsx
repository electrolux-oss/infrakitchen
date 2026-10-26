import {
  Children,
  FocusEvent,
  forwardRef,
  isValidElement,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { HeroChevronDownIcon } from "../icons";
import { cn } from "../utils/cn";

import { inputBoxClasses, InputLabel, useFormControl } from "./FormControl";
import { Menu, MenuItemProps, MenuSelectionContext } from "./Menu";

/** Change event passed to Select's onChange. */
export interface SelectChangeEvent<T = unknown> {
  target: { value: T; name: string };
  currentTarget: { value: T; name: string };
  nativeEvent?: Event;
}

export interface SelectProps<T = unknown> {
  value?: T;
  onChange?: (event: SelectChangeEvent<T>, child?: ReactNode) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onOpen?: () => void;
  onClose?: () => void;
  name?: string;
  id?: string;
  /** MenuItem children; their `value` props are the options. */
  children?: ReactNode;
  multiple?: boolean;
  renderValue?: (value: T) => ReactNode;
  /** Show renderValue/empty state even when nothing is selected. */
  displayEmpty?: boolean;
  disabled?: boolean;
  error?: boolean;
  /** Label drawn above the box when used outside TextField. */
  label?: ReactNode;
  labelId?: string;
  /** `standard` drops the box (borderless inline select). */
  variant?: "outlined" | "standard";
  size?: "small" | "medium";
  fullWidth?: boolean;
  required?: boolean;
  className?: string;
  /** Classes for the dropdown surface. */
  menuClassName?: string;
  placeholder?: string;
  inputProps?: { "aria-label"?: string; id?: string };
  "aria-label"?: string;
  /** react-hook-form's field ref; receives the focusable combobox. */
  inputRef?: Ref<HTMLElement>;
}

function isSameValue(a: unknown, b: unknown) {
  return a === b || (a != null && b != null && String(a) === String(b));
}

function SelectInner<T>(
  {
    value,
    onChange,
    onBlur,
    onOpen,
    onClose,
    name = "",
    id,
    children,
    multiple = false,
    renderValue,
    displayEmpty = false,
    disabled,
    error,
    label,
    labelId,
    variant = "outlined",
    size,
    fullWidth,
    required,
    className,
    menuClassName,
    placeholder,
    inputProps,
    "aria-label": ariaLabel,
    inputRef,
  }: SelectProps<T>,
  ref: Ref<HTMLElement>,
) {
  const control = useFormControl();
  const generatedId = useId();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useImperativeHandle(ref, () => buttonRef.current as HTMLElement);
  useImperativeHandle(inputRef, () => buttonRef.current as HTMLElement);

  const isDisabled = disabled ?? control?.disabled ?? false;
  const isError = error ?? control?.error ?? false;
  const fieldSize = size ?? control?.size ?? "small";
  const buttonId = inputProps?.id ?? id ?? control?.inputId ?? generatedId;

  const options = Children.toArray(children).filter(
    (child): child is ReactElement<MenuItemProps> =>
      isValidElement<MenuItemProps>(child),
  );

  const selectedValues: unknown[] = multiple
    ? Array.isArray(value)
      ? value
      : []
    : [value];

  const isSelected = (optionValue: unknown) =>
    selectedValues.some((v) => isSameValue(v, optionValue));

  const emit = (next: unknown, event?: MouseEvent<HTMLElement>) => {
    const target = { value: next as T, name };
    onChange?.({
      target,
      currentTarget: target,
      nativeEvent: event?.nativeEvent,
    });
  };

  const select = (optionValue: unknown, event: MouseEvent<HTMLElement>) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      emit(
        isSelected(optionValue)
          ? current.filter((v: unknown) => !isSameValue(v, optionValue))
          : [...current, optionValue],
        event,
      );
      return;
    }
    if (!isSameValue(value, optionValue)) emit(optionValue, event);
    close();
  };

  const openMenu = () => {
    if (isDisabled) return;
    setOpen(true);
    onOpen?.();
  };
  const close = () => {
    setOpen(false);
    onClose?.();
  };

  const isEmpty = multiple
    ? selectedValues.length === 0
    : value === undefined || value === null || value === "";

  let display: ReactNode = null;
  if (renderValue && (!isEmpty || displayEmpty)) {
    display = renderValue(value as T);
  } else if (!isEmpty || displayEmpty) {
    const labels = options
      .filter((option) => isSelected(option.props.value))
      .map((option) => option.props.children);
    display = multiple
      ? labels.map((item, index) => (
          <span key={index}>
            {index > 0 && ", "}
            {item}
          </span>
        ))
      : (labels[0] ?? null);
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu();
    }
  };

  const standard = variant === "standard";

  return (
    <>
      {label && !control && (
        <InputLabel id={labelId} htmlFor={buttonId}>
          {label}
        </InputLabel>
      )}
      <div
        ref={buttonRef}
        id={buttonId}
        role="combobox"
        tabIndex={isDisabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${buttonId}-listbox` : undefined}
        aria-labelledby={labelId}
        aria-label={inputProps?.["aria-label"] ?? ariaLabel}
        aria-invalid={isError || undefined}
        aria-required={required || control?.required || undefined}
        aria-disabled={isDisabled || undefined}
        onClick={openMenu}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={cn(
          "relative cursor-pointer outline-none select-none",
          standard
            ? "flex min-h-8 items-center bg-transparent text-body2"
            : inputBoxClasses({ disabled: isDisabled, size: fieldSize }),
          "pr-8",
          standard && "focus-visible:underline",
          !standard &&
            "focus-visible:border-grey-800 focus-visible:outline-2 focus-visible:outline-grey-900/15 aria-expanded:border-grey-800 aria-expanded:outline-2 aria-expanded:outline-grey-900/15",
          isDisabled && "cursor-default",
          fullWidth && "w-full",
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
          {display ?? (
            <span className="text-grey-500 opacity-70">
              {placeholder ?? "​"}
            </span>
          )}
        </span>
        <HeroChevronDownIcon
          className={cn(
            "pointer-events-none absolute right-2 size-4 text-fg-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </div>
      {name && (
        <input
          type="hidden"
          name={name}
          value={Array.isArray(value) ? value.join(",") : String(value ?? "")}
        />
      )}
      <MenuSelectionContext.Provider value={{ isSelected, select }}>
        <Menu
          open={open}
          anchorEl={buttonRef.current}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          matchAnchorWidth
          listRole="listbox"
          id={`${buttonId}-listbox`}
          aria-labelledby={labelId}
          className={cn("max-h-[50vh]", menuClassName)}
        >
          {children}
        </Menu>
      </MenuSelectionContext.Provider>
    </>
  );
}

/**
 * Dropdown select: a combobox showing the chosen MenuItem (or renderValue)
 * that opens a listbox Menu. onChange receives `{ target: { value, name } }`,
 * so react-hook-form's field.onChange works as is.
 */
export const Select = forwardRef(SelectInner) as <T = unknown>(
  props: SelectProps<T> & { ref?: Ref<HTMLElement> },
) => ReturnType<typeof SelectInner>;
