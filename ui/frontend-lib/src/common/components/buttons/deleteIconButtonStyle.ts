import { alpha, Theme } from "@mui/material/styles";

/**
 * Shared style for row-level delete icon buttons (small trash IconButton):
 * neutral by default, tinting red on hover to signal the destructive action.
 * Kept in one place so every list/table remove button matches the filter
 * panel's remove button.
 */
export const deleteIconButtonStyle = {
  color: "text.secondary",
  border: "none",
  backgroundColor: "transparent",
  "&:hover": {
    backgroundColor: (theme: Theme) =>
      alpha(theme.palette.error.main, 0.08),
    color: "error.main",
  },
} as const;