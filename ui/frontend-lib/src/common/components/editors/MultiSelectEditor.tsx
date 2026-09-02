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
    onChange={(_event, newValue) => onChange(newValue as T[])}
    getOptionLabel={getOptionLabel}
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
