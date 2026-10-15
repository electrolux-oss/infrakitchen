import {
  ChangeEvent,
  CSSProperties,
  FocusEventHandler,
  KeyboardEvent,
  ReactNode,
  Ref,
  RefObject,
  SyntheticEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  useCombobox,
  UseComboboxState,
  UseComboboxStateChangeOptions,
  useMultipleSelection,
} from "downshift";

import { ArrowDropDownIcon, CloseIcon } from "../icons/material";
import { cn } from "../utils/cn";

import { Chip } from "./Chip";
import {
  FormControl,
  FormHelperText,
  FormMargin,
  inputBoxClasses,
  InputLabel,
} from "./FormControl";
import { Spinner } from "./Spinner";
import { useControllable } from "./useControllable";

type FreeSoloValue<FreeSolo> = FreeSolo extends true ? string : never;

/** One picked value: an option, or typed text with `freeSolo`. */
export type AutocompleteItem<T, FreeSolo> = T | FreeSoloValue<FreeSolo>;

export type AutocompleteValue<T, Multiple, FreeSolo> = Multiple extends true
  ? AutocompleteItem<T, FreeSolo>[]
  : AutocompleteItem<T, FreeSolo> | null;

/** Why the input text changed. */
export type AutocompleteInputChangeReason = "input" | "reset" | "clear";

export interface AutocompleteProps<
  T,
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
> {
  options: readonly T[];
  value: AutocompleteValue<T, Multiple, FreeSolo> | undefined;
  /** The event is null when the change came from the keyboard hooks. */
  onChange?: (
    event: SyntheticEvent | null,
    value: AutocompleteValue<T, Multiple, FreeSolo>,
  ) => void;
  multiple?: Multiple;
  /** Accept typed text that matches no option (committed with Enter). */
  freeSolo?: FreeSolo;
  getOptionLabel?: (option: AutocompleteItem<T, FreeSolo>) => string;
  /** Defaults to strict equality. */
  isOptionEqualToValue?: (
    option: T,
    value: AutocompleteItem<T, FreeSolo>,
  ) => boolean;
  getOptionDisabled?: (option: T) => boolean;
  /** Stable identity for an option; defaults to its label. */
  getOptionKey?: (option: AutocompleteItem<T, FreeSolo>) => string;
  /** Content of an option row in the list; defaults to its label. */
  renderOption?: (option: T) => ReactNode;
  /**
   * Content of the picked value: a chip label with `multiple`, otherwise rich
   * content shown in the box in place of the input text.
   */
  renderValue?: (value: AutocompleteItem<T, FreeSolo>) => ReactNode;
  inputValue?: string;
  onInputChange?: (
    event: SyntheticEvent | null,
    value: string,
    reason: AutocompleteInputChangeReason,
  ) => void;
  /** Defaults to a case-insensitive "label contains" match. */
  filterOptions?: (options: T[], inputValue: string) => T[];
  loading?: boolean;
  noOptionsText?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  disableClearable?: boolean;
  /** Show at most this many chips, then a "+N" chip. */
  limitTags?: number;
  /** Classes for the outlined box (the FormControl takes `className`). */
  inputClassName?: string;
  // Field props, applied as on TextField.
  label?: ReactNode;
  placeholder?: string;
  helperText?: ReactNode;
  error?: boolean;
  required?: boolean;
  margin?: FormMargin;
  fullWidth?: boolean;
  size?: "small" | "medium";
  id?: string;
  name?: string;
  "aria-label"?: string;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  className?: string;
}

// Gap between the field and the list, and the list's largest height.
const GAP = 4;
const MAX_LIST_HEIGHT = 320;

/** Fixed-position style placing the list under the anchor, or above it when
 * there is more room there. */
function useListPosition(
  anchorRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor) {
      setStyle(null);
      return;
    }
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const listHeight = Math.min(
        listRef.current?.scrollHeight ?? 0,
        MAX_LIST_HEIGHT,
      );
      const below = window.innerHeight - rect.bottom - GAP * 2;
      const above = rect.top - GAP * 2;
      const flip = below < listHeight && above > below;
      setStyle({
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(MAX_LIST_HEIGHT, flip ? above : below),
        ...(flip
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: rect.bottom + GAP }),
      });
    };
    place();
    window.addEventListener("resize", place);
    // Capture scrolls of any ancestor (dialogs, panels), not just the page.
    window.addEventListener("scroll", place, true);
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    if (listRef.current) observer.observe(listRef.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer.disconnect();
    };
  }, [anchorRef, listRef, open]);

  return style;
}

const defaultLabel = (option: unknown): string => {
  if (option == null) return "";
  if (typeof option === "object" && "label" in option) {
    return String((option as { label: unknown }).label);
  }
  return String(option);
};

/**
 * Combobox built on Downshift's useCombobox (plus useMultipleSelection for
 * chips). It takes the field props (label, helperText, error, ...) directly instead of a
 * renderInput callback.
 */
export function Autocomplete<
  T,
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>({
  options,
  value,
  onChange,
  multiple,
  freeSolo,
  getOptionLabel = defaultLabel,
  isOptionEqualToValue,
  getOptionDisabled,
  getOptionKey,
  renderOption,
  renderValue,
  inputValue: inputValueProp,
  onInputChange,
  filterOptions,
  loading = false,
  noOptionsText = "No options",
  disabled = false,
  readOnly = false,
  disableClearable = false,
  limitTags,
  inputClassName,
  label,
  placeholder,
  helperText,
  error = false,
  required = false,
  margin = "none",
  fullWidth = false,
  size = "small",
  id,
  name,
  "aria-label": ariaLabel,
  inputRef,
  onBlur,
  className,
}: AutocompleteProps<T, Multiple, FreeSolo>) {
  type Item = AutocompleteItem<T, FreeSolo>;

  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const labelId = `${generatedId}-label`;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selectedItems: Item[] = multiple
    ? ((value as Item[] | undefined) ?? [])
    : [];
  const selectedItem: Item | null = multiple
    ? null
    : ((value as Item | null | undefined) ?? null);

  // Rich single values replace the input text instead of filling it.
  const richSingle = !multiple && renderValue !== undefined;
  const textFor = (item: Item | null) =>
    item == null || richSingle ? "" : getOptionLabel(item);

  const [inputValue, setInputValue] = useControllable(
    inputValueProp,
    textFor(selectedItem),
    undefined,
  );
  const changeInput = (
    next: string,
    reason: AutocompleteInputChangeReason,
    event: SyntheticEvent | null = null,
  ) => {
    if (next === inputValue) return;
    setInputValue(next);
    onInputChange?.(event, next, reason);
  };

  const itemKey = (item: Item | null) =>
    item == null
      ? null
      : getOptionKey
        ? getOptionKey(item)
        : getOptionLabel(item);
  const isEqual = (option: T, item: Item) =>
    isOptionEqualToValue ? isOptionEqualToValue(option, item) : option === item;

  const isSelected = (option: T) =>
    multiple
      ? selectedItems.some((item) => isEqual(option, item))
      : selectedItem !== null && isEqual(option, selectedItem);

  // A single value's own label in the input is not a search: list everything.
  const searching =
    inputValue !== "" &&
    (multiple ||
      selectedItem === null ||
      inputValue !== getOptionLabel(selectedItem));
  const items: T[] = !searching
    ? [...options]
    : filterOptions
      ? filterOptions([...options], inputValue)
      : options.filter((option) =>
          getOptionLabel(option as Item)
            .toLowerCase()
            .includes(inputValue.toLowerCase()),
        );

  const emit = (next: Item[] | Item | null) =>
    onChange?.(null, next as AutocompleteValue<T, Multiple, FreeSolo>);

  const commitMultiple = (next: Item[]) => {
    emit(next);
    changeInput("", "reset");
  };

  const toggleOption = (option: T) => {
    const without = selectedItems.filter((item) => !isEqual(option, item));
    emit(
      without.length < selectedItems.length
        ? without
        : [...selectedItems, option as Item],
    );
  };

  const { getSelectedItemProps, getDropdownProps, removeSelectedItem } =
    useMultipleSelection<Item>({
      selectedItems,
      itemToKey: itemKey,
      onSelectedItemsChange: ({ selectedItems: next }) => {
        if (multiple) emit(next ?? []);
      },
    });

  const {
    isOpen,
    highlightedIndex,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    getToggleButtonProps,
    closeMenu,
  } = useCombobox<T>({
    items,
    inputId,
    labelId,
    itemToString: (item) => (item == null ? "" : getOptionLabel(item as Item)),
    itemToKey: (item) => itemKey(item as Item | null),
    isItemDisabled: (item) => getOptionDisabled?.(item) ?? false,
    // Multiple values live in useMultipleSelection, not here.
    selectedItem: (multiple ? null : selectedItem) as T | null,
    inputValue,
    stateReducer: (
      state: UseComboboxState<T>,
      { type, changes }: UseComboboxStateChangeOptions<T>,
    ) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEscape:
          // Escape only closes the list; Downshift would also clear a closed
          // field; keep it (and let an enclosing Dialog close).
          return state.isOpen
            ? { ...changes, selectedItem: state.selectedItem }
            : state;
        case useCombobox.stateChangeTypes.InputBlur:
          // No select-on-blur; free text stays, other text reverts.
          return {
            ...changes,
            selectedItem: state.selectedItem,
            inputValue: freeSolo ? state.inputValue : textFor(selectedItem),
          };
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          // The picked item is reported through onStateChange; with
          // `multiple` the controlled selectedItem stays null.
          if (multiple) return { ...changes, inputValue: "" };
          return {
            ...changes,
            inputValue: textFor((changes.selectedItem ?? null) as Item | null),
          };
        case useCombobox.stateChangeTypes.ControlledPropUpdatedSelectedItem:
          return { ...changes, inputValue: textFor(selectedItem) };
        default:
          return changes;
      }
    },
    onStateChange: ({ type, selectedItem: picked }) => {
      const isPick =
        type === useCombobox.stateChangeTypes.InputKeyDownEnter ||
        type === useCombobox.stateChangeTypes.ItemClick;
      if (!isPick || picked == null) return;
      // The input text follows through onInputValueChange.
      if (multiple) toggleOption(picked);
      else emit(picked as Item);
    },
    // Downshift reports changes after render; typing is taken from the
    // input's own onChange instead, so a controlled input never lags a key.
    onInputValueChange: ({ type, inputValue: next }) => {
      if (type !== useCombobox.stateChangeTypes.InputChange) {
        changeInput(next ?? "", "reset");
      }
    },
  });

  const listStyle = useListPosition(boxRef, listRef, isOpen);

  const commitFreeText = (event: KeyboardEvent<HTMLInputElement>) => {
    const text = multiple ? inputValue.trim() : inputValue;
    if (!text) return;
    event.preventDefault();
    if (multiple) {
      const duplicate = selectedItems.some(
        (item) => getOptionLabel(item) === text,
      );
      commitMultiple(
        duplicate ? selectedItems : [...selectedItems, text as Item],
      );
    } else {
      emit(text as Item);
    }
    closeMenu();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // A focused-away IME composition commits with Enter; leave it be.
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && isOpen) {
      // Close the list, not an enclosing Dialog.
      event.stopPropagation();
    }
    if (
      event.key === "Enter" &&
      freeSolo &&
      (!isOpen || highlightedIndex < 0)
    ) {
      commitFreeText(event);
      (
        event.nativeEvent as { preventDownshiftDefault?: boolean }
      ).preventDownshiftDefault = true;
    }
  };

  const setInputRef = (node: HTMLInputElement | null) => {
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  };

  const interactive = !disabled && !readOnly;
  const hasValue = multiple ? selectedItems.length > 0 : selectedItem !== null;
  const showClear =
    interactive && !disableClearable && (hasValue || inputValue !== "");
  // Free text needs no "No options" row; typing is the point.
  const showEmpty = items.length === 0 && (loading || !freeSolo);
  const listOpen = isOpen && interactive && (items.length > 0 || showEmpty);

  const clear = (event: SyntheticEvent) => {
    event.stopPropagation();
    onChange?.(
      event,
      (multiple ? [] : null) as AutocompleteValue<T, Multiple, FreeSolo>,
    );
    changeInput("", "clear", event);
  };

  // Chip keys (Backspace, ArrowLeft) only apply while the list is closed;
  // Downshift then omits them, so our own handlers are chained separately.
  const dropdownProps = getDropdownProps({
    ref: setInputRef,
    preventKeyAction: isOpen,
  }) as { onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void };
  const inputProps = getInputProps({
    ...dropdownProps,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      handleKeyDown(event);
      if (!event.defaultPrevented) dropdownProps.onKeyDown?.(event);
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      changeInput(event.target.value, "input", event),
    onBlur,
    disabled,
    readOnly,
    name,
    placeholder: hasValue && (multiple || richSingle) ? undefined : placeholder,
    "aria-label": ariaLabel,
    "aria-invalid": error || undefined,
    "aria-describedby": helperId,
  });

  return (
    <FormControl
      error={error}
      disabled={disabled}
      required={required}
      fullWidth={fullWidth}
      margin={margin}
      size={size}
      className={className}
    >
      {label && (
        <InputLabel {...getLabelProps()} htmlFor={inputId} id={labelId}>
          {label}
        </InputLabel>
      )}
      <div
        ref={boxRef}
        className={cn(
          inputBoxClasses({ disabled, size }),
          "cursor-text gap-1 pr-1.5",
          multiple && "h-auto flex-wrap py-[3px]",
          multiple && (size === "medium" ? "min-h-10" : "min-h-8"),
          inputClassName,
        )}
        onClick={(event) => {
          // Clicks on the box padding focus the input; chips keep theirs.
          if (!disabled && event.target === event.currentTarget) {
            document.getElementById(inputId)?.focus();
          }
        }}
      >
        {multiple &&
          selectedItems.slice(0, limitTags).map((item, index) => (
            <Chip
              key={`${itemKey(item)}-${index}`}
              size="small"
              variant="outlined"
              className="max-w-full"
              label={renderValue ? renderValue(item) : getOptionLabel(item)}
              {...getSelectedItemProps({ selectedItem: item, index })}
              onDelete={
                interactive
                  ? (event) => {
                      event.stopPropagation();
                      removeSelectedItem(item);
                    }
                  : undefined
              }
            />
          ))}
        {limitTags !== undefined && selectedItems.length > limitTags && (
          <Chip
            size="small"
            variant="outlined"
            label={`+${selectedItems.length - limitTags}`}
          />
        )}
        {richSingle && selectedItem !== null && inputValue === "" && (
          <span className="inline-flex min-w-0 shrink items-center">
            {renderValue!(selectedItem)}
          </span>
        )}
        <input
          {...inputProps}
          className={cn(
            "min-w-[30px] flex-1 border-0 bg-transparent p-0 font-[inherit] leading-[inherit] text-[inherit] text-inherit outline-none placeholder:text-grey-500 placeholder:opacity-70 disabled:text-fg-disabled",
          )}
        />
        {loading && <Spinner size={16} className="shrink-0" />}
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear"
            title="Clear"
            onClick={clear}
            className="invisible flex shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-0.5 text-fg-muted group-focus-within/field:visible group-hover/field:visible hover:bg-hover"
          >
            <CloseIcon fontSize="small" />
          </button>
        )}
        {!readOnly && !freeSolo && (
          <button
            type="button"
            {...getToggleButtonProps({ disabled })}
            tabIndex={-1}
            aria-label={isOpen ? "Close" : "Open"}
            className="flex shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-0.5 text-fg-muted hover:bg-hover disabled:cursor-default"
          >
            <ArrowDropDownIcon
              fontSize="small"
              className={cn(
                "transition-transform duration-150",
                listOpen && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
      {helperText && (
        <FormHelperText id={helperId}>{helperText}</FormHelperText>
      )}
      {createPortal(
        <ul
          {...getMenuProps({ ref: listRef }, { suppressRefError: true })}
          hidden={!listOpen}
          className={cn(
            "fixed z-[1350] m-0 list-none overflow-auto rounded-surface border border-divider bg-paper p-1 font-sans text-body2 text-fg shadow-dropdown",
            !listStyle && "invisible",
          )}
          style={listStyle ?? undefined}
        >
          {listOpen &&
            items.map((option, index) => {
              const optionDisabled = getOptionDisabled?.(option) ?? false;
              return (
                <li
                  key={`${index}-${itemKey(option as Item)}`}
                  {...getItemProps({ item: option, index })}
                  className={cn(
                    "flex min-h-8 cursor-pointer items-center rounded-surface px-3 py-1.5 select-none",
                    isSelected(option) && "bg-primary/8",
                    highlightedIndex === index &&
                      (isSelected(option) ? "bg-primary/12" : "bg-hover"),
                    optionDisabled && "cursor-default opacity-40",
                  )}
                >
                  {renderOption
                    ? renderOption(option)
                    : getOptionLabel(option as Item)}
                </li>
              );
            })}
          {listOpen && showEmpty && (
            <li className="px-3 py-1.5 text-fg-muted" role="presentation">
              {loading ? "Loading…" : noOptionsText}
            </li>
          )}
        </ul>,
        document.body,
      )}
    </FormControl>
  );
}
