import { createTheme, alpha } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

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

export const brand = {
  50: "hsl(210, 100%, 95%)",
  100: "hsl(210, 100%, 92%)",
  200: "hsl(210, 100%, 80%)",
  300: "hsl(210, 100%, 65%)",
  400: "hsl(210, 98%, 55%)",
  500: "hsl(210, 98%, 48%)",
  600: "hsl(210, 98%, 42%)",
  700: "hsl(210, 100%, 35%)",
  800: "hsl(210, 100%, 16%)",
  900: "hsl(210, 100%, 21%)",
};

export const grey = {
  50: "hsl(220, 10%, 97%)",
  100: "hsl(220, 8%, 94%)",
  200: "hsl(220, 5%, 88%)",
  300: "hsl(220, 5%, 80%)",
  400: "hsl(220, 5%, 65%)",
  500: "hsl(220, 5%, 42%)",
  600: "hsl(220, 5%, 35%)",
  700: "hsl(220, 5%, 25%)",
  800: "hsl(220, 8%, 6%)",
  900: "hsl(220, 10%, 3%)",
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

export const colorSchemes = {
  light: {
    palette: {
      mode: "light" as "light",
      primary: {
        light: brand[200],
        main: brand[400],
        dark: brand[600],
        contrastText: brand[50],
      },
      info: {
        light: brand[100],
        main: brand[300],
        dark: brand[600],
        contrastText: grey[50],
      },
      warning: {
        light: orange[300],
        main: orange[400],
        dark: orange[800],
        text: "black",
      },
      error: {
        light: red[300],
        main: red[400],
        dark: red[800],
        text: "white",
      },
      success: {
        light: green[300],
        main: green[500],
        dark: green[700],
        text: "white",
      },
      grey: {
        ...grey,
      },
      divider: alpha(grey[300], 0.4),
      background: {
        default: "hsl(0, 0%, 99%)",
        paper: "hsl(220, 35%, 97%)",
      },
      text: {
        primary: grey[800],
        secondary: grey[600],
        warning: orange[400],
      },
      link: {
        primary: brand[600],
        hover: brand[700],
      },
      action: {
        hover: alpha(grey[200], 0.2),
        selected: `${alpha(grey[200], 0.3)}`,
        disabled: "#BBBBBB",
      },
      baseShadow:
        "hsla(220, 30%, 5%, 0.07) 0px 4px 16px 0px, hsla(220, 25%, 10%, 0.07) 0px 8px 16px -5px",
    },
  },
  dark: {
    palette: {
      mode: "dark" as "dark",
      primary: {
        contrastText: brand[50],
        light: brand[300],
        main: brand[400],
        dark: brand[700],
      },
      info: {
        contrastText: brand[300],
        light: brand[500],
        main: brand[700],
        dark: brand[900],
      },
      warning: {
        light: orange[400],
        main: orange[500],
        dark: orange[700],
      },
      error: {
        light: red[300],
        main: red[300],
        dark: red[600],
        text: grey[900],
      },
      success: {
        light: green[400],
        main: green[500],
        dark: green[700],
      },
      grey: {
        ...grey,
      },
      divider: alpha(grey[700], 0.6),
      background: {
        default: "#1E1E1E",
        paper: "#131313",
      },
      text: {
        primary: "hsl(0, 0%, 100%)",
        secondary: grey[400],
      },
      link: {
        primary: brand[300],
        hover: brand[200],
      },
      action: {
        hover: alpha(grey[600], 0.2),
        selected: alpha(grey[600], 0.3),
        disabled: "#555555",
      },
      baseShadow:
        "hsla(220, 30%, 5%, 0.7) 0px 4px 16px 0px, hsla(220, 25%, 10%, 0.8) 0px 8px 16px -5px",
    },
  },
};

export const typography = {
  fontFamily:
    '-apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  h1: {
    fontSize: defaultTheme.typography.pxToRem(28),
    fontWeight: 600,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: defaultTheme.typography.pxToRem(24),
    fontWeight: 600,
    lineHeight: 1.2,
  },
  h3: {
    fontSize: defaultTheme.typography.pxToRem(22),
    lineHeight: 1.2,
  },
  h4: {
    fontSize: defaultTheme.typography.pxToRem(20),
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h5: {
    fontSize: defaultTheme.typography.pxToRem(18),
    fontWeight: 600,
  },
  h6: {
    fontSize: defaultTheme.typography.pxToRem(16),
    fontWeight: 500,
  },
  subtitle1: {
    fontSize: defaultTheme.typography.pxToRem(14),
    opacity: "75%",
  },
  subtitle2: {
    fontSize: defaultTheme.typography.pxToRem(12),
    fontWeight: 500,
    opacity: "75%",
  },
  body1: {
    fontSize: defaultTheme.typography.pxToRem(15),
  },
  body2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 400,
  },
  caption: {
    fontSize: defaultTheme.typography.pxToRem(12),
    fontWeight: 400,
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
