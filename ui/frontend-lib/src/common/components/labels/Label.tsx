import type { ChipProps } from "@mui/material";
import { Chip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

const labelSx: SxProps<Theme> = (theme) => ({
  height: 18,
  fontSize: "0.6875rem",
  fontWeight: 500,
  backgroundColor: "#fff",
  borderColor: "#d0d7de",
  borderRadius: "999px",
  "& .MuiChip-label": {
    px: 0.5,
  },
  // `theme.palette.mode` is frozen to the default scheme when CSS variables
  // are enabled, so dark-mode styling must go through `applyStyles` instead.
  ...theme.applyStyles("dark", {
    backgroundColor: "#21262d",
    borderColor: "#3d444d",
  }),
});

export const Label = ({ sx, ...chipProps }: ChipProps) => (
  <Chip
    variant="outlined"
    sx={sx === undefined ? labelSx : ([labelSx, sx] as SxProps<Theme>)}
    {...chipProps}
  />
);
