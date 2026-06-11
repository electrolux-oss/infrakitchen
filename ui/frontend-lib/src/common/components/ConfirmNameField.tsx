import { Box, InputAdornment, TextField, Typography } from "@mui/material";

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
        To confirm, type{" "}
        <Box
          component="code"
          sx={{
            px: 0.5,
            py: 0.25,
            bgcolor: "action.selected",
            borderRadius: 0.5,
            fontFamily: "monospace",
            fontSize: "0.85em",
          }}
        >
          {name}
        </Box>{" "}
        below.
      </Typography>
      <TextField
        fullWidth
        size="small"
        placeholder={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={value.length > 0 && !matched}
        InputProps={{
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
        }}
        autoComplete="off"
      />
    </Box>
  );
};
