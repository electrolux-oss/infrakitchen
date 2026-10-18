import { useEffect, useState } from "react";

import { MenuItem, Select, Switch, TextField } from "../../ui";
import { sameValue } from "../utils";

export interface VariableCellInputProps {
  type: string;
  sensitive: boolean;
  value: unknown;
  placeholder?: string;
  /** Allowed values from the template; renders a select for strings. */
  options?: string[];
  /** Shown but not changeable (frozen variable). */
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onValidityChange?: (valid: boolean) => void;
  ariaLabel: string;
}

/** Compact input for one variable value, picked by the variable type. */
export const VariableCellInput = ({
  type,
  sensitive,
  value,
  placeholder,
  options = [],
  disabled = false,
  onChange,
  onValidityChange,
  ariaLabel,
}: VariableCellInputProps) => {
  const isJson = type !== "string" && type !== "number" && type !== "boolean";
  const [text, setText] = useState(() =>
    isJson && value !== undefined ? JSON.stringify(value) : "",
  );
  const [invalid, setInvalid] = useState(false);

  // Keep the JSON text in sync when the value changes from outside (bulk row).
  useEffect(() => {
    if (!isJson) return;
    try {
      if (!sameValue(JSON.parse(text), value)) {
        setText(value === undefined ? "" : JSON.stringify(value));
        setInvalid(false);
        onValidityChange?.(true);
      }
    } catch {
      // Mid-edit invalid text: keep what the user is typing.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (type === "boolean") {
    return (
      <Switch
        checked={value === true}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
    );
  }

  if (type === "number") {
    return (
      <TextField
        type="number"
        disabled={disabled}
        value={value === null || value === undefined ? "" : Number(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next === "" ? null : Number(next));
        }}
        inputProps={{ "aria-label": ariaLabel }}
      />
    );
  }

  if (type === "string" && options.length > 0) {
    // Keep a current value that is no longer an option selectable/visible.
    const choices =
      typeof value === "string" && value !== "" && !options.includes(value)
        ? [value, ...options]
        : options;
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        displayEmpty
        disabled={disabled}
        variant="outlined"
        size="small"
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            {placeholder}
          </MenuItem>
        )}
        {choices.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    );
  }

  if (type === "string") {
    return (
      <TextField
        type={sensitive ? "password" : "text"}
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ "aria-label": ariaLabel }}
      />
    );
  }

  return (
    <TextField
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      error={invalid}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        try {
          onChange(JSON.parse(next));
          setInvalid(false);
          onValidityChange?.(true);
        } catch {
          setInvalid(true);
          onValidityChange?.(false);
        }
      }}
      inputProps={{ "aria-label": ariaLabel }}
    />
  );
};
