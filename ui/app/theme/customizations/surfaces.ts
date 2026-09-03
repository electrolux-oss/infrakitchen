import { alpha, Theme, Components } from "@mui/material/styles";

import { CODE_FONT_FAMILY } from "@electrolux-oss/infrakitchen";

import { grey, shape } from "../themePrimitives";

export const surfacesCustomizations: Components<Theme> = {
  // Single CSS variable for the surface corner radius, emitted from the theme
  // token (shape.borderRadius). Surfaces reference `var(--template-surface-radius)`
  // so changing the radius is a one-line change here — components never hardcode
  // a number. `:root` is correct because shape does not vary by color scheme.
  // Note: MuiCssBaseline styleOverrides keys are top-level selectors (html,
  // body, ...), so `:root` must be a key directly — wrapping it under `root`
  // would emit a rule that never matches and the variable would be undefined.
  MuiCssBaseline: {
    styleOverrides: {
      ":root": {
        "--template-surface-radius": `${shape.borderRadius}px`,
        // Tighter corner radius for inline and block code chips so they read
        // as a smaller treatment than 8px surfaces.
        "--template-code-radius": "4px",
      },
      // Match the Typography default (body2 / 14px): MUI's CssBaseline
      // otherwise sizes the body element with body1 (16px), which unstyled
      // text inherits. Keep only the size-related props so the default
      // body rule (color, background, margin) stays intact.
      //
      // Note: MuiCssBaseline styleOverrides must be plain objects — callback
      // functions are silently dropped, so body2's literals are duplicated
      // here instead of computed.
      body: {
        fontSize: "0.875rem",
        lineHeight: 1.43,
      },
      // Raw <code> elements (entity names / identifiers inline in prose and
      // dialogs) otherwise fall back to the browser's default monospace stack;
      // route them through the app's code font token so code-like content
      // matches InlineCode, logs, and every other code-font usage.
      code: {
        fontFamily: CODE_FONT_FAMILY,
      },
    },
  },
  MuiAccordion: {
    defaultProps: {
      elevation: 0,
      disableGutters: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        padding: 4,
        overflow: "clip",
        backgroundColor: (theme.vars || theme).palette.background.paper,
        border: "1px solid",
        borderColor: (theme.vars || theme).palette.divider,
        ":before": {
          backgroundColor: "transparent",
        },
        "&:not(:last-of-type)": {
          borderBottom: "none",
        },
        "&:first-of-type": {
          borderTopLeftRadius: (theme.vars || theme).shape.borderRadius,
          borderTopRightRadius: (theme.vars || theme).shape.borderRadius,
        },
        "&:last-of-type": {
          borderBottomLeftRadius: (theme.vars || theme).shape.borderRadius,
          borderBottomRightRadius: (theme.vars || theme).shape.borderRadius,
        },
      }),
    },
  },
  MuiAccordionSummary: {
    styleOverrides: {
      root: ({ theme }) => ({
        border: "none",
        borderRadius: (theme.vars || theme).shape.borderRadius,
        "&:focus-visible": { backgroundColor: "transparent" },
      }),
    },
  },
  MuiAccordionDetails: {
    styleOverrides: {
      root: { mb: 20, border: "none" },
    },
  },
  MuiPaper: {
    defaultProps: {
      elevation: 0,
    },
  },
  // DataGrid is content: white (paper), not the grey canvas. The grid paints
  // its container via a CSS variable, so set both the variable and the
  // background color to stay robust across MUI X versions. Its own radius
  // variable (`--unstable_DataGrid-radius`) can resolve unitless, so declare
  // the radius explicitly to keep the grid's corners rounded like every other
  // surface.
  MuiDataGrid: {
    styleOverrides: {
      root: ({ theme }) => ({
        "--DataGrid-t-color-background-base": (theme.vars || theme).palette
          .background.paper,
        backgroundColor: (theme.vars || theme).palette.background.paper,
        borderRadius: "var(--template-surface-radius)",
      }),
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({ theme }) => {
        return {
          padding: 16,
          gap: 16,
          transition: "all 100ms ease",
          // White (paper) cards on the grey canvas background.
          backgroundColor: (theme.vars || theme).palette.background.paper,
          borderRadius: (theme.vars || theme).shape.borderRadius,
          border: `1px solid ${(theme.vars || theme).palette.divider}`,
          boxShadow: "none",
          variants: [
            {
              props: {
                variant: "outlined",
              },
              style: {
                border: `1px solid ${(theme.vars || theme).palette.divider}`,
                boxShadow: "none",
                background: "hsl(0, 0%, 100%)",
                ...theme.applyStyles("dark", {
                  background: alpha(grey[900], 0.4),
                }),
              },
            },
          ],
        };
      },
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: 0,
        "&:last-child": { paddingBottom: 12 },
      },
    },
  },
  MuiCardHeader: {
    styleOverrides: {
      root: {
        padding: 0,
        marginBottom: 24,
      },
      // h6-sized (20px): CardHeader's own default title variant (h5 / 24px)
      // can't be overridden via theme defaultProps, so size it here instead.
      title: {
        fontSize: "1.25rem",
        fontWeight: 600,
      },
      subheader: {
        fontSize: "0.875rem",
      },
    },
  },
  MuiCardActions: {
    styleOverrides: {
      root: {
        padding: 0,
      },
    },
  },
};
