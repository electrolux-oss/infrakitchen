import {
  ChangeEvent,
  createContext,
  HTMLAttributes,
  InputHTMLAttributes,
  useContext,
} from "react";

import { cn } from "../utils/cn";

interface RadioGroupState {
  name?: string;
  value: unknown;
  onChange?: (event: ChangeEvent<HTMLInputElement>, value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupState | null>(null);

export interface RadioGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  name?: string;
  value: unknown;
  onChange?: (event: ChangeEvent<HTMLInputElement>, value: string) => void;
  /** Lay the radios out in a row. */
  row?: boolean;
}

export function RadioGroup({
  name,
  value,
  onChange,
  row = false,
  className,
  ...rest
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onChange }}>
      <div
        role="radiogroup"
        className={cn(
          "flex",
          row ? "flex-row flex-wrap" : "flex-col",
          className,
        )}
        {...rest}
      />
    </RadioGroupContext.Provider>
  );
}

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  value: string;
}

/** daisyUI `radio`, wired to the surrounding RadioGroup. */
export function Radio({
  value,
  className,
  checked,
  onChange,
  ...rest
}: RadioProps) {
  const group = useContext(RadioGroupContext);
  return (
    <input
      type="radio"
      value={value}
      name={group?.name}
      checked={checked ?? (group ? String(group.value) === value : undefined)}
      onChange={(event) => {
        onChange?.(event);
        group?.onChange?.(event, event.target.value);
      }}
      className={cn("d-radio m-[11px] d-radio-sm d-radio-primary", className)}
      {...rest}
    />
  );
}
