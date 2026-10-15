import { Autocomplete } from "../../../ui";

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
    options={[] as string[]}
    value={value}
    onChange={(_event, newValue) =>
      // Trim whitespace, drop empties, and prevent duplicates.
      onChange(
        newValue
          .map((v) => v.trim())
          .filter((v, index, arr) => v.length > 0 && arr.indexOf(v) === index),
      )
    }
    aria-label={label}
    placeholder="Add a label..."
    helperText={helperText}
    fullWidth
  />
);

export default StringTagEditor;
