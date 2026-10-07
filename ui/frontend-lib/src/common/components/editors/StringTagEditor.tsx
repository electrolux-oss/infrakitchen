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
    onChange={(_event, newValue) =>
      // Trim whitespace, drop empties, and prevent duplicates.
      onChange(
        (newValue as string[])
          .map((v) => v.trim())
          .filter((v, index, arr) => v.length > 0 && arr.indexOf(v) === index),
      )
    }
    size="small"
    renderValue={(items: readonly string[], getTagProps) =>
      items.map((option: string, index: number) => {
        const { key, ...rest } = getTagProps({ index });
        return <Chip key={key} {...rest} variant="outlined" label={option} />;
      })
    }
    renderInput={(params) => (
      <TextField
        {...params}
        aria-label={label}
        placeholder="Add a label..."
        helperText={helperText}
        fullWidth
      />
    )}
  />
);

export default StringTagEditor;
