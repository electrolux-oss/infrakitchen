import type { ChipProps } from "@mui/material";
import { Chip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

const labelSx: SxProps<Theme> = {
  height: 18,
  fontSize: "0.6875rem",
  fontWeight: 500,
  backgroundColor: (theme) =>
    theme.palette.mode === "dark" ? "#21262d" : "#fff",
  borderColor: (theme) =>
    theme.palette.mode === "dark" ? "#3d444d" : "#d0d7de",
  borderRadius: "999px",
  "& .MuiChip-label": {
    px: 0.5,
  },
};

export const Label = ({ sx, ...chipProps }: ChipProps) => (
  <Chip
    variant="outlined"
    sx={sx === undefined ? labelSx : ([labelSx, sx] as SxProps<Theme>)}
    {...chipProps}
  />
);
