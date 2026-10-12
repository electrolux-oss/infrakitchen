import type { ChipProps } from "@mui/material";
import { Chip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

/**
 * Built-in Label tones. Each maps to a palette-backed, theme-aware style
 * pair (light + dark) so consumers pick a semantic look instead of
 * hand-writing colors.
 *
 * default: the classic outlined white/gray chip (the original look).
 * primary / secondary / info / success / warning / error: outlined
 *   chips tinted with that palette color in both modes.
 */
export type LabelTone =
  | "default"
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "error";

interface ToneStyle {
  sx: SxProps<Theme>;
  /** Chip's color prop (drives the ripple and any internal CSS vars). */
  chipColor?: ChipProps["color"];
}

const toneStyles: Record<LabelTone, ToneStyle> = {
  default: { sx: {} },
  primary: {
    chipColor: "primary",
    sx: { color: "primary.main", borderColor: "primary.main" },
  },
  secondary: {
    chipColor: "secondary",
    sx: { color: "secondary.main", borderColor: "secondary.main" },
  },
  info: {
    chipColor: "info",
    sx: { color: "info.main", borderColor: "info.main" },
  },
  success: {
    chipColor: "success",
    sx: { color: "success.main", borderColor: "success.main" },
  },
  warning: {
    chipColor: "warning",
    sx: { color: "warning.main", borderColor: "warning.main" },
  },
  error: {
    chipColor: "error",
    sx: { color: "error.main", borderColor: "error.main" },
  },
};

const sizeStyles = {
  small: { height: 18, fontSize: "0.6875rem" },
  medium: { height: 24, fontSize: "0.8125rem" },
  large: { height: 30, fontSize: "0.875rem" },
} as const;

const makeLabelSx =
  (size: LabelSize): SxProps<Theme> =>
  (theme) => ({
    height: sizeStyles[size].height,
    fontSize: sizeStyles[size].fontSize,
    backgroundColor: "#fff",
    borderColor: "#d0d7de",
    borderRadius: "999px",
    "& .MuiChip-label": {
      px: 0.5,
      // Set the font on the span itself: the app theme pins the label span
      // to the caption size for small/medium chips, which beats inheritance
      // from the root.
      fontSize: sizeStyles[size].fontSize,
    },
    // theme.palette.mode is frozen to the default scheme when CSS variables
    // are enabled, so dark-mode styling must go through applyStyles instead.
    ...theme.applyStyles("dark", {
      backgroundColor: "#21262d",
      borderColor: "#3d444d",
    }),
  });

/** Visual size. Defaults to the compact small size used in tables. */
export type LabelSize = "small" | "medium" | "large";

export interface LabelProps extends Omit<ChipProps, "size"> {
  /** Built-in look; defaults to the classic outlined default chip. */
  tone?: LabelTone;
  /** Height and font size; defaults to small. */
  size?: LabelSize;
}

export const Label = ({
  tone = "default",
  size = "small",
  sx,
  ...chipProps
}: LabelProps) => {
  const { sx: toneSx, chipColor } = toneStyles[tone];
  const labelSx = makeLabelSx(size);
  return (
    <Chip
      variant="outlined"
      {...(chipColor ? { color: chipColor } : {})}
      sx={
        sx === undefined
          ? ([labelSx, toneSx] as SxProps<Theme>)
          : ([labelSx, toneSx, sx] as SxProps<Theme>)
      }
      {...chipProps}
    />
  );
};
