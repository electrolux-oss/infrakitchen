import {
  createContext,
  ElementType,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  useContext,
  useId,
} from "react";

import { cn } from "../utils/cn";

export interface FormControlState {
  error: boolean;
  disabled: boolean;
  required: boolean;
  size: "small" | "medium";
  /** id for the input, shared with its label and helper text. */
  inputId: string;
}

const FormControlContext = createContext<FormControlState | null>(null);

export function useFormControl() {
  return useContext(FormControlContext);
}

export type FormMargin = "none" | "dense" | "normal";

const MARGINS: Record<FormMargin, string> = {
  none: "",
  dense: "mt-2 mb-1",
  normal: "mt-4 mb-2",
};

export interface FormControlProps extends HTMLAttributes<HTMLElement> {
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  margin?: FormMargin;
  size?: "small" | "medium";
  /** Element to render as; `fieldset` groups radios/checkboxes. */
  component?: ElementType;
  children?: ReactNode;
}

/**
 * Field wrapper: holds the label, input and
 * helper text, applies the form margins and shares error/disabled/required
 * state with its children.
 */
export function FormControl({
  error = false,
  disabled = false,
  required = false,
  fullWidth = false,
  margin = "none",
  size = "small",
  component: Component = "div",
  className,
  children,
  ...rest
}: FormControlProps) {
  const inputId = useId();
  return (
    <FormControlContext.Provider
      value={{ error, disabled, required, size, inputId }}
    >
      <Component
        className={cn(
          "group/field relative inline-flex min-w-0 flex-col border-0 p-0 align-top",
          MARGINS[margin],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {children}
      </Component>
    </FormControlContext.Provider>
  );
}

export interface InputLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  error?: boolean;
  required?: boolean;
}

/** Field label floating above the input box. */
export function InputLabel({
  error,
  required,
  className,
  htmlFor,
  children,
  ...rest
}: InputLabelProps) {
  const control = useFormControl();
  const isError = error ?? control?.error ?? false;
  const isRequired = required ?? control?.required ?? false;
  return (
    <label
      htmlFor={htmlFor ?? control?.inputId}
      className={cn(
        "pointer-events-auto absolute -top-4 left-1 z-[1] max-w-[calc(100%-8px)] truncate text-[12px] leading-[17px] text-fg-muted group-focus-within/field:text-primary",
        isError && "text-error group-focus-within/field:text-error",
        control?.disabled && "text-fg-disabled",
        className,
      )}
      {...rest}
    >
      {children}
      {isRequired && <span aria-hidden> *</span>}
    </label>
  );
}

export interface FormHelperTextProps extends HTMLAttributes<HTMLParagraphElement> {
  error?: boolean;
}

export function FormHelperText({
  error,
  className,
  ...rest
}: FormHelperTextProps) {
  const control = useFormControl();
  const isError = error ?? control?.error ?? false;
  return (
    <p
      id={control ? `${control.inputId}-helper` : undefined}
      className={cn(
        "mx-3.5 mt-1 mb-0 text-[12px] leading-[1.4] text-fg-muted",
        isError && "text-error",
        className,
      )}
      {...rest}
    />
  );
}

export interface FormLabelProps extends LabelHTMLAttributes<HTMLElement> {
  component?: ElementType;
}

/** Standalone group label (radio/checkbox groups), caption-sized. */
export function FormLabel({
  component: Component = "label",
  className,
  ...rest
}: FormLabelProps) {
  const control = useFormControl();
  return (
    <Component
      className={cn(
        "mb-2 block text-caption text-fg-muted",
        control?.error && "text-error",
        className,
      )}
      {...rest}
    />
  );
}

export interface InputAdornmentProps extends HTMLAttributes<HTMLDivElement> {
  position: "start" | "end";
}

export function InputAdornment({
  position,
  className,
  ...rest
}: InputAdornmentProps) {
  return (
    <div
      className={cn(
        "flex max-h-[2em] shrink-0 items-center whitespace-nowrap text-grey-500 dark:text-grey-400",
        position === "start" ? "mr-2" : "ml-2",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Outlined input box classes shared by TextField and Select. Errors show in
 * the label and helper text, not the border.
 */
export function inputBoxClasses({
  disabled,
  multiline,
  size,
}: {
  error?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  size?: "small" | "medium";
}) {
  return cn(
    "flex w-full min-w-0 items-center rounded-surface border border-divider bg-paper px-3 py-2 font-sans text-body2 leading-[1.4375] text-fg transition-[border-color] duration-[120ms] ease-in",
    "hover:border-grey-400 focus-within:border-grey-800 focus-within:outline-2 focus-within:outline-grey-900/15 dark:hover:border-grey-500",
    !multiline && (size === "medium" ? "h-10" : "h-8 min-h-8"),
    multiline && "items-start",
    disabled && "pointer-events-none text-fg-disabled",
  );
}
