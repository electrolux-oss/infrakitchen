import { Autocomplete, Chip, TextField } from "@mui/material";

export interface StringTagEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  helperText?: string;
}

export const StringTagEditor = ({
  value,
  onChange,
  label,
  helperText,
}: StringTagEditorProps) => (
  <Autocomplete
    multiple
    freeSolo
    options={[]}
    value={value}
    onChange={(_event, newValue) => onChange(newValue as string[])}
    renderValue={(items: readonly string[], getTagProps) =>
      items.map((option: string, index: number) => {
        const { key, ...rest } = getTagProps({ index });
        return <Chip key={key} {...rest} variant="outlined" label={option} />;
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

export default StringTagEditor;
