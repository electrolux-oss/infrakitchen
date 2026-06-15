import { Autocomplete, Chip, TextField } from "@mui/material";

export interface MultiSelectEditorProps<T> {
  value: T[];
  onChange: (value: T[]) => void;
  label: string;
  helperText?: string;
  options: T[];
  getOptionLabel: (option: T) => string;
}

/** Generic multi-select editor with chips, reusable for typed option lists. */
export const MultiSelectEditor = <T,>({
  value,
  onChange,
  label,
  helperText,
  options,
  getOptionLabel,
}: MultiSelectEditorProps<T>) => (
  <Autocomplete
    multiple
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
        label={label}
        helperText={helperText}
        fullWidth
        margin="normal"
      />
    )}
  />
);

export default MultiSelectEditor;
