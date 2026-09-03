import { Box, InputAdornment, TextField, Typography } from "@mui/material";

import { InlineCode } from "./InlineCode";

interface ConfirmNameFieldProps {
  /** The entity name the user must type to confirm. */
  name: string;
  value: string;
  onChange: (value: string) => void;
}

export const ConfirmNameField = ({
  name,
  value,
  onChange,
}: ConfirmNameFieldProps) => {
  const matched = value === name;

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        To confirm, type <InlineCode>{name}</InlineCode> below.
      </Typography>
      <TextField
        fullWidth
        placeholder={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={value.length > 0 && !matched}
        slotProps={{
          input: {
            endAdornment: value.length > 0 && (
              <InputAdornment position="end">
                <Typography
                  variant="caption"
                  color={matched ? "success.main" : "error.main"}
                >
                  {matched ? "✓" : "✗"}
                </Typography>
              </InputAdornment>
            ),
          },
        }}
        autoComplete="off"
      />
    </Box>
  );
};
