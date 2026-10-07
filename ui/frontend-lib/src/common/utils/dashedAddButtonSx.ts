import type { SxProps, Theme } from "@mui/material/styles";

// Compact dashed "Add" action used to append a row to list editors, matching
// the "Add filter" control in the filter panel.
export const dashedAddButtonSx: SxProps<Theme> = {
  height: 28,
  minHeight: 0,
  p: "0 10px",
  color: "text.secondary",
  border: "1px dashed",
  borderColor: "divider",
  borderRadius: 1,
  "& .MuiSvgIcon-root": { fontSize: 16 },
  "&:hover": {
    color: "text.primary",
    borderColor: "text.secondary",
    backgroundColor: "action.hover",
  },
};
