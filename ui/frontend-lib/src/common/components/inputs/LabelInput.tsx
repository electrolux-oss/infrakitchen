import { forwardRef, ReactNode } from "react";

import { Autocomplete } from "../../../ui";

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
      options={[] as string[]}
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
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
  );
});

LabelInput.displayName = "LabelInput";
