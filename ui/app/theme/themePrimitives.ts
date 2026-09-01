// Activates MUI X's theme module augmentation (MuiDataGrid in Components<T>).
import "@mui/x-data-grid/themeAugmentation";

import { createTheme, alpha } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

import { CODE_FONT_FAMILY } from "@electrolux-oss/infrakitchen";

declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    highlighted: true;
  }
}
declare module "@mui/material/styles" {
  interface ColorRange {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  }

  interface PaletteColor extends ColorRange {}

  interface Palette {
    baseShadow: string;
    link: {
      primary: string;
      hover: string;
    };
  }
}

const defaultTheme = createTheme();

// Neutral monochrome scale. This is deliberately a pure black-grey ramp, not
// blue-tinted: surfaces and text read as clean monochrome rather than "cloud blue".
export const brand = {
  50: "hsl(0, 0%, 96%)",
  100: "hsl(0, 0%, 90%)",
  200: "hsl(0, 0%, 82%)",
  300: "hsl(0, 0%, 62%)",
  400: "hsl(0, 0%, 45%)",
  500: "hsl(0, 0%, 25%)",
  600: "hsl(0, 0%, 15%)",
  700: "hsl(0, 0%, 9%)",
  800: "hsl(0, 0%, 4.5%)",
  900: "hsl(0, 0%, 0%)",
};

export const grey = {
  50: "hsl(0, 0%, 98%)",
  100: "hsl(0, 0%, 96%)",
  200: "hsl(0, 0%, 92%)",
  300: "hsl(0, 0%, 84%)",
  400: "hsl(0, 0%, 66%)",
  500: "hsl(0, 0%, 45%)",
  600: "hsl(0, 0%, 34%)",
  700: "hsl(0, 0%, 25%)",
  800: "hsl(0, 0%, 15%)",
  900: "hsl(0, 0%, 4%)",
};

export const green = {
  50: "hsl(120, 80%, 98%)",
  100: "hsl(120, 75%, 94%)",
  200: "hsl(120, 75%, 87%)",
  300: "hsl(120, 61%, 77%)",
  400: "hsl(120, 44%, 53%)",
  500: "hsl(120, 59%, 30%)",
  600: "hsl(120, 70%, 25%)",
  700: "hsl(120, 75%, 16%)",
  800: "hsl(120, 84%, 10%)",
  900: "hsl(120, 87%, 6%)",
};

export const orange = {
  50: "hsl(42, 100%, 96%)",
  100: "hsl(42, 98%, 88%)",
  200: "hsl(42, 96%, 75%)",
  300: "hsl(42, 95%, 60%)",
  400: "hsl(38, 92%, 50%)",
  500: "hsl(35, 90%, 45%)",
  600: "hsl(32, 88%, 40%)",
  700: "hsl(28, 85%, 32%)",
  800: "hsl(26, 82%, 24%)",
  900: "hsl(24, 80%, 15%)",
};

export const red = {
  50: "hsl(0, 100%, 97%)",
  100: "hsl(0, 92%, 90%)",
  200: "hsl(0, 94%, 80%)",
  300: "hsl(0, 90%, 60%)",
  400: "hsl(0, 90%, 40%)",
  500: "hsl(0, 90%, 30%)",
  600: "hsl(0, 91%, 25%)",
  700: "hsl(0, 94%, 18%)",
  800: "hsl(0, 95%, 12%)",
  900: "hsl(0, 93%, 6%)",
};

// Accent brand hue used to highlight the active/selected navigation item.
// A vivid blue that stays readable on both light and dark surfaces.
export const accent = {
  50: "hsl(217, 91%, 97%)",
  100: "hsl(214, 95%, 93%)",
  200: "hsl(213, 94%, 88%)",
  300: "hsl(214, 92%, 78%)",
  400: "hsl(217, 91%, 60%)",
  500: "hsl(221, 83%, 53%)",
  600: "hsl(224, 76%, 48%)",
  700: "hsl(226, 71%, 40%)",
  800: "hsl(228, 68%, 32%)",
  900: "hsl(229, 66%, 26%)",
};

export const colorSchemes = {
  light: {
    palette: {
      mode: "light" as "light",
      // The "primary" action color is pure black, not a brand hue.
      primary: {
        light: brand[200],
        main: grey[900],
        dark: brand[900],
        contrastText: "#ffffff",
      },
      info: {
        light: brand[100],
        main: grey[900],
        dark: brand[900],
        contrastText: grey[50],
      },
      warning: {
        light: orange[300],
        // `main` matches success/error main's tuned saturation/lightness so all
        // semantic `main` colors share a consistent tone (hue differs).
        main: "hsl(38, 46%, 42%)",
        dark: orange[800],
        text: "black",
      },
      error: {
        light: red[300],
        // `main` matches success.main's tuned saturation/lightness (hue differs)
        // so all semantic `main` colors share a consistent tone.
        main: "hsl(0, 46%, 42%)",
        dark: red[800],
        text: "white",
      },
      success: {
        light: green[400],
        // `main` is a tuned blend of green[400] and green[600] so white text
        // stays readable on it (e.g. the "Updated" badge).
        main: "hsl(120, 46%, 42%)",
        dark: green[700],
        text: "white",
      },
      grey: {
        ...grey,
      },
      divider: alpha(grey[200], 0.9),
      background: {
        // Light grey canvas shared by the page header, sidebar and content
        // background, so white cards/content stand out on top.
        default: "rgb(250, 250, 250)",
        paper: "hsl(0, 0%, 100%)",
      },
      text: {
        primary: grey[900],
        secondary: grey[500],
        warning: orange[400],
      },
      link: {
        primary: grey[900],
        hover: grey[600],
      },
      action: {
        hover: alpha(grey[900], 0.05),
        selected: `${alpha(grey[900], 0.08)}`,
        disabled: "#BBBBBB",
      },
      baseShadow:
        "hsla(0, 0%, 0%, 0.05) 0px 1px 2px 0px, hsla(0, 0%, 0%, 0.05) 0px 4px 16px 0px",
    },
  },
  dark: {
    palette: {
      mode: "dark" as "dark",
      primary: {
        contrastText: grey[900],
        light: grey[200],
        main: grey[50],
        dark: brand[500],
      },
      info: {
        contrastText: grey[900],
        light: grey[200],
        main: grey[50],
        dark: brand[500],
      },
      warning: {
        light: orange[400],
        // Matches the light theme's success/error/warning main treatment.
        main: "hsl(38, 44%, 44%)",
        dark: orange[700],
      },
      error: {
        light: red[300],
        // Matches the light theme's success/error main treatment.
        main: "hsl(0, 44%, 44%)",
        dark: red[600],
        text: grey[900],
      },
      success: {
        light: green[400],
        // Tuned blend (see light theme) so white text stays readable on it.
        main: "hsl(120, 44%, 44%)",
        dark: green[700],
      },
      grey: {
        ...grey,
      },
      divider: alpha(grey[600], 0.55),
      background: {
        default: "hsl(0, 0%, 8%)",
        paper: "hsl(0, 0%, 10%)",
      },
      text: {
        primary: "hsl(0, 0%, 97%)",
        secondary: grey[400],
      },
      link: {
        primary: grey[50],
        hover: grey[300],
      },
      action: {
        hover: alpha(grey[100], 0.08),
        selected: alpha(grey[100], 0.14),
        disabled: "#555555",
      },
      baseShadow:
        "hsla(0, 0%, 0%, 0.55) 0px 1px 2px 0px, hsla(0, 0%, 0%, 0.5) 0px 4px 16px 0px",
    },
  },
};

export const typography = {
  fontFamily:
    '"Geist", -apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  // Fixed-width stack for code-like content (IDs, config values, logs). Kept
  // as its own token so the code font is changeable in one place. No mono font
  // is bundled, so this resolves to the OS default monospace glyphs today.
  fontFamilyMonospace: CODE_FONT_FAMILY,
  h1: {
    fontSize: defaultTheme.typography.pxToRem(96),
    fontWeight: 500,
    lineHeight: 1.06,
    letterSpacing: "-0.03em",
  },
  h2: {
    fontSize: defaultTheme.typography.pxToRem(60),
    fontWeight: 500,
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
  },
  h3: {
    fontSize: defaultTheme.typography.pxToRem(48),
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
  },
  h4: {
    fontSize: defaultTheme.typography.pxToRem(34),
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "-0.015em",
  },
  h5: {
    fontSize: defaultTheme.typography.pxToRem(24),
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "-0.015em",
  },
  h6: {
    fontSize: defaultTheme.typography.pxToRem(20),
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },
  subtitle1: {
    fontSize: defaultTheme.typography.pxToRem(16),
    lineHeight: 1.5,
    color: grey[500],
  },
  subtitle2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 500,
    lineHeight: 1.4,
    color: grey[500],
  },
  body1: {
    fontSize: defaultTheme.typography.pxToRem(16),
    lineHeight: 1.5,
    letterSpacing: "0em",
  },
  body2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 400,
    lineHeight: 1.43,
  },
  caption: {
    fontSize: defaultTheme.typography.pxToRem(12),
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "0.01em",
  },
};

export const shape = {
  borderRadius: 8,
};

// @ts-ignore
const defaultShadows: Shadows = [
  "none",
  "var(--template-palette-baseShadow)",
  ...defaultTheme.shadows.slice(2),
];
export const shadows = defaultShadows;
