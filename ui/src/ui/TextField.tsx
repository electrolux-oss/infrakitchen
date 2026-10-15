import {
  ChangeEvent,
  ChangeEventHandler,
  CSSProperties,
  FocusEventHandler,
  forwardRef,
  InputHTMLAttributes,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  Ref,
  RefObject,
  useId,
  useLayoutEffect,
  useRef,
} from "react";

import { cn } from "../utils/cn";

import {
  FormControl,
  FormHelperText,
  FormMargin,
  inputBoxClasses,
  InputLabel,
} from "./FormControl";
import { Select, SelectProps } from "./Select";

type InputElement = HTMLInputElement | HTMLTextAreaElement;

/** Attributes passed straight to the native input/textarea. */
export type TextFieldInputProps = InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
  [attribute: `data-${string}`]: string | undefined;
};

/** Select-mode props (renderValue, displayEmpty, multiple, ...). */
export type TextFieldSelectProps = Partial<
  Pick<
    SelectProps,
    "renderValue" | "displayEmpty" | "multiple" | "inputProps" | "menuClassName"
  >
>;

export interface TextFieldProps {
  label?: ReactNode;
  value?: unknown;
  defaultValue?: unknown;
  onChange?: ChangeEventHandler<InputElement>;
  onBlur?: FocusEventHandler<InputElement | HTMLElement>;
  onFocus?: FocusEventHandler<InputElement>;
  onKeyDown?: KeyboardEventHandler<InputElement>;
  /** Click anywhere on the field (label, box or helper text). */
  onClick?: MouseEventHandler<HTMLElement>;
  name?: string;
  id?: string;
  type?: string;
  placeholder?: string;
  helperText?: ReactNode;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  margin?: FormMargin;
  size?: "small" | "medium";
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  /** Render a Select with MenuItem children instead of a text input. */
  select?: boolean;
  children?: ReactNode;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  inputRef?: Ref<InputElement | HTMLElement>;
  readOnly?: boolean;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  /** Attributes for the native input/textarea. */
  inputProps?: TextFieldInputProps;
  /** Classes for the outlined input box. */
  inputClassName?: string;
  selectProps?: TextFieldSelectProps;
  className?: string;
  "aria-label"?: string;
}

const LINE_HEIGHT_PX = 20.125;

/** Grows a textarea between minRows and maxRows. */
function useAutosize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: unknown,
  minRows?: number,
  maxRows?: number,
  rows?: number,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || rows) return;
    el.style.height = "auto";
    const min = (minRows ?? 1) * LINE_HEIGHT_PX;
    const max = maxRows ? maxRows * LINE_HEIGHT_PX : Infinity;
    const height = Math.min(Math.max(el.scrollHeight, min), max);
    el.style.height = `${height}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  });
  return value;
}

/**
 * Labelled text input: label above an outlined box, helper text below, with multiline (auto-growing) and select modes.
 * The ref goes to the native input, so react-hook-form's {...field} works.
 */
export const TextField = forwardRef<InputElement | HTMLElement, TextFieldProps>(
  function TextField(
    {
      label,
      value,
      defaultValue,
      onChange,
      onBlur,
      onFocus,
      onKeyDown,
      onClick,
      name,
      id,
      type = "text",
      placeholder,
      helperText,
      error = false,
      required = false,
      disabled = false,
      fullWidth = false,
      margin = "none",
      size = "small",
      multiline = false,
      rows,
      minRows,
      maxRows,
      select = false,
      children,
      autoFocus,
      autoComplete,
      inputMode,
      inputRef,
      readOnly,
      startAdornment,
      endAdornment,
      inputProps: htmlInput = {},
      inputClassName,
      selectProps,
      className,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    useAutosize(textareaRef, value, minRows, maxRows, rows);

    const setRefs = (node: InputElement | HTMLElement | null) => {
      for (const target of [ref, inputRef]) {
        if (typeof target === "function") target(node);
        else if (target) (target as { current: typeof node }).current = node;
      }
    };

    const helperId = helperText ? `${inputId}-helper` : undefined;

    const fieldLabel = label && (
      <InputLabel htmlFor={inputId}>{label}</InputLabel>
    );

    let field: ReactNode;
    if (select) {
      field = (
        <Select
          value={value}
          onChange={(event) =>
            onChange?.(event as unknown as ChangeEvent<InputElement>)
          }
          onBlur={onBlur}
          name={name}
          id={inputId}
          disabled={disabled}
          error={error}
          size={size}
          required={required}
          inputRef={setRefs}
          aria-label={ariaLabel}
          {...selectProps}
        >
          {children}
        </Select>
      );
    } else {
      const common = {
        id: inputId,
        name,
        // null is a common react-hook-form default; render it as empty.
        value: (value === null ? "" : value) as string | undefined,
        defaultValue: defaultValue as string | undefined,
        onChange,
        onBlur,
        onFocus,
        onKeyDown,
        placeholder,
        required,
        disabled,
        readOnly,
        autoFocus,
        autoComplete,
        "aria-label": ariaLabel,
        "aria-invalid": error || undefined,
        "aria-describedby": helperId,
        className:
          "min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] text-inherit outline-none placeholder:text-grey-500 placeholder:opacity-70 disabled:text-fg-disabled",
      };
      field = (
        <div
          className={cn(
            inputBoxClasses({ disabled, multiline, size }),
            inputClassName,
          )}
        >
          {startAdornment}
          {multiline ? (
            <textarea
              {...common}
              {...(htmlInput as InputHTMLAttributes<HTMLTextAreaElement>)}
              ref={(node) => {
                textareaRef.current = node;
                setRefs(node);
              }}
              rows={rows ?? minRows ?? 1}
              className={cn(
                common.className,
                "resize-none",
                htmlInput.className,
              )}
            />
          ) : (
            <input
              {...common}
              type={type}
              inputMode={inputMode}
              {...htmlInput}
              ref={setRefs}
              className={cn(common.className, htmlInput.className)}
            />
          )}
          {endAdornment}
        </div>
      );
    }

    return (
      <FormControl
        error={error}
        disabled={disabled}
        required={required}
        fullWidth={fullWidth}
        margin={margin}
        size={size}
        className={className}
        onClick={onClick}
      >
        {fieldLabel}
        {field}
        {helperText && (
          <FormHelperText id={helperId}>{helperText}</FormHelperText>
        )}
      </FormControl>
    );
  },
);
