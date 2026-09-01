import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { ChipProps } from "@mui/material/Chip";
import type { SystemStyleObject } from "@mui/system";

// Soft informational blue for the "optional" badges. The global `info` palette
// is deliberately monochrome (near-black), so chips get their own hue here.
export const SOFT_BLUE = "hsl(211, 92%, 50%)";

// Sizing shared by the pill chip styles. `compact` is for chips rendered inside
// dense contexts like datagrid rows.
const chipSize = (compact: boolean) =>
  compact
    ? {
        height: 16,
        fontSize: "0.5625rem",
        letterSpacing: "0.04em",
      }
    : {
        height: 20,
        fontSize: "0.625rem",
        letterSpacing: "0.06em",
      };

// Soft pill chip style used across cards (e.g. the "Abstract" chip and the
// tag chips). Single centralized definition; callers only supply the tint
// color (e.g. theme.palette.info.main or theme.palette.grey[600]). Uses a
// translucent tinted fill, which reads as a light pastel pill on any surface.
// Chips that need to overlap a border must add an opaque background on top.
export const softChipSx = (
  main: string,
  compact = false,
): SystemStyleObject<Theme> => ({
  ...chipSize(compact),
  borderRadius: "999px",
  bgcolor: alpha(main, 0.14),
  color: main,
  border: `1px solid ${alpha(main, 0.32)}`,
  "& .MuiChip-label": {
    px: 1,
    lineHeight: 1.2,
  },
});

// Resolves a MUI chip `color` name to the tint color used by the pill styles.
// `default` (or an unknown color) falls back to the neutral grey; `info` uses
// the soft blue instead of the monochrome info palette.
const resolveChipMain = (
  color: ChipProps["color"] | undefined,
  theme: Theme,
): string => {
  if (!color || color === "default") {
    // Neutral grey for label/tag chips: light solid fill in light mode, and
    // as colored text/border on the dark-mode outlined pills.
    return theme.palette.grey[400];
  }
  if (color === "info") {
    // Soft blue instead of the monochrome info palette.
    return SOFT_BLUE;
  }
  return theme.palette[color]?.main ?? theme.palette.grey[600];
};

// Convenience wrapper for semantic chips: pass a MUI chip `color` name and get
// a callback that tints the pill with that palette color.
export const softChipColorSx =
  (color: ChipProps["color"] = "default", compact = false) =>
  (theme: Theme): SystemStyleObject<Theme> =>
    softChipSx(resolveChipMain(color, theme), compact);

// Solid filled pill (white text on the tint color), matching the style of the
// "Updated" badge. Used for badges that need an opaque fill — e.g. one that
// straddles a card border, where a translucent background would show the line
// underneath — or where a bolder filled look is desired.
export const solidChipColorSx =
  (
    color: ChipProps["color"] = "default",
    customMain?: (theme: Theme) => string,
    customLabelColor?: (theme: Theme) => string,
    compact = false,
  ) =>
  (theme: Theme): SystemStyleObject<Theme> => {
    const main = customMain ? customMain(theme) : resolveChipMain(color, theme);
    const labelColor = customLabelColor ? customLabelColor(theme) : "#fff";

    return {
      ...chipSize(compact),
      lineHeight: 1.2,
      borderRadius: "999px",
      // Solid filled pill in light mode. In dark mode, solid fills blend into
      // the dark surface, so render as a tinted outlined pill instead
      // (transparent background, colored border + text) so chips stay visible.
      bgcolor: main,
      color: labelColor,
      border: "none",
      "& .MuiChip-label": {
        px: 1,
        // Regular weight so badges read as plain text, not bold/semibold.
        fontWeight: 400,
        // MUI's `.MuiChip-filled.MuiChip-colorDefault` class sets the label
        // color to `text.primary` with higher specificity than the root sx
        // `color`, so it must be overridden here to keep the text white.
        color: labelColor,
      },
      // Note: `theme.palette.mode` always reads as the default scheme with
      // CSS-variable theming, so dark-mode styling must go through applyStyles.
      ...theme.applyStyles("dark", {
        bgcolor: "transparent",
        color: main,
        border: `1px solid ${alpha(main, 0.55)}`,
        "& .MuiChip-label": {
          px: 1,
          fontWeight: 400,
          color: main,
        },
      }),
    };
  };
