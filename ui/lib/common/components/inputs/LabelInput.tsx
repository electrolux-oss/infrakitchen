import { forwardRef, ReactNode } from "react";

import { Autocomplete, Chip, TextField } from "@mui/material";

interface LabelInputProps {
  errors: any;
  value: string[];
  onChange: (value: string[]) => void;
  helpertext?: ReactNode;
  [key: string]: any;
}

export const LabelInput = forwardRef<any, LabelInputProps>((props, _ref) => {
  const { errors, value, onChange = () => {}, helpertext } = props;

  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      renderValue={(value: readonly string[], getTagProps) =>
        value.map((option: string, index: number) => {
          const { key, ...rest } = getTagProps({ index });
          return <Chip key={key} {...rest} variant="outlined" label={option} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Labels"
          error={!!errors.labels}
          helperText={
            errors.labels
              ? errors.labels.message
              : helpertext || "Add labels and press Enter"
          }
          fullWidth
          margin="normal"
        />
      )}
    />
  );
});

LabelInput.displayName = "LabelInput";
