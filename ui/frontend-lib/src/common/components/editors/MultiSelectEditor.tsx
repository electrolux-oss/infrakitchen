import { Autocomplete, Chip, TextField } from "@mui/material";

export interface MultiSelectEditorProps<T> {
  value: T[];
  onChange: (value: T[]) => void;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  helperText?: string;
  options: T[];
  getOptionLabel: (option: T) => string;
}

/**
 * Stable identity key for an option: its `id` when the option carries one,
 * otherwise its label. Selected values and options can be separate instances
 * of the same entity, so reference comparison would let users select the same
 * entry twice.
 */
const getOptionKey = <T,>(
  option: T,
  getOptionLabel: (option: T) => string,
): string => {
  if (typeof option === "object" && option !== null) {
    const id = (option as unknown as { id?: unknown }).id;
    if (id !== undefined && id !== null) {
      return `id:${String(id)}`;
    }
  }
  return `label:${getOptionLabel(option)}`;
};

/** Generic multi-select editor with chips, reusable for typed option lists. */
export const MultiSelectEditor = <T,>({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder,
  helperText,
  options,
  getOptionLabel,
}: MultiSelectEditorProps<T>) => (
  <Autocomplete
    multiple
    size="small"
    options={options}
    value={value}
    onChange={(_event, newValue) => {
      const seen = new Set<string>();
      onChange(
        (newValue as T[]).filter((option) => {
          const key = getOptionKey(option, getOptionLabel);
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        }),
      );
    }}
    getOptionLabel={getOptionLabel}
    getOptionDisabled={(option) =>
      value.some(
        (selected) =>
          getOptionKey(selected, getOptionLabel) ===
          getOptionKey(option, getOptionLabel),
      )
    }
    isOptionEqualToValue={(option, selected) =>
      getOptionKey(option, getOptionLabel) ===
      getOptionKey(selected, getOptionLabel)
    }
    renderValue={(items: readonly T[], getTagProps) =>
      items.map((option: T, index: number) => {
        const { key, ...rest } = getTagProps({ index });
        return (
          <Chip
            key={key}
            {...rest}
            variant="outlined"
            label={getOptionLabel(option)}
          />
        );
      })
    }
    renderInput={(params) => (
      <TextField
        {...params}
        label={label ? label : undefined}
        placeholder={placeholder}
        helperText={helperText}
        fullWidth
        margin="dense"
        slotProps={{
          ...params.slotProps,
          htmlInput: {
            ...params.slotProps.htmlInput,
            ...(label ? {} : { "aria-label": ariaLabel || label || "" }),
          },
        }}
      />
    )}
  />
);

export default MultiSelectEditor;
