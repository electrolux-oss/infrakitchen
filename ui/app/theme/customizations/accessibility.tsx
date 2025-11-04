import { iconButtonClasses } from "@mui/material/IconButton";
import { Theme, Components, alpha } from "@mui/material/styles";

/**
 * Accessibility customizations for MUI components.
 * These customizations address common accessibility issues by:
 * - Setting minimum font sizes for better readability (only for very small fonts)
 * - Ensuring proper aria-labels for Select components
 * - Improving touch targets
 * - Following WCAG guidelines for interactive elements
 */
export const accessibilityCustomizations: Components<Theme> = {
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        // Enhanced hiding for MUI's internal auto-sizing textareas
        "& textarea[aria-hidden='true'][readonly][tabindex='-1']": {
          // Screen reader exclusion - comprehensive approach
          position: "absolute !important",
          left: "-10000px !important",
          top: "-10000px !important",
          width: "1px !important",
          height: "1px !important",
          overflow: "hidden !important",
          clip: "rect(1px, 1px, 1px, 1px) !important",
          clipPath: "inset(50%) !important",
          visibility: "hidden !important",
          opacity: "0 !important",
          border: "0 !important",
          margin: "-1px !important",
          padding: "0 !important",
        },
      },
      notchedOutline: {
        "& legend": {
          fontSize: "max(0.875rem, 14px)",
          "& span": {
            fontSize: "max(0.875rem, 14px)",
          },
        },
      },
    },
  },

  MuiSelect: {
    defaultProps: {
      inputProps: {
        "aria-label": "Select option",
      },
    },
    styleOverrides: {
      select: {
        minHeight: "1.4375em",
      },
      nativeInput: {
        "&[aria-hidden='true']": {
          position: "absolute !important",
          left: "-10000px !important",
          width: "1px !important",
          height: "1px !important",
          overflow: "hidden !important",
          clip: "rect(1px, 1px, 1px, 1px) !important",
          visibility: "hidden !important",
        },
      },
      icon: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
        "&:hover": {
          color: (theme.vars || theme).palette.text.primary,
        },
      }),
    },
  },

  MuiInput: {
    styleOverrides: {
      root: {
        "& textarea[aria-hidden='true']": {
          "&:not([aria-label])": {
            position: "absolute !important",
            left: "-10000px !important",
            width: "1px !important",
            height: "1px !important",
            overflow: "hidden !important",
            clip: "rect(1px, 1px, 1px, 1px) !important",
          },
        },
      },
    },
  },

  MuiFormHelperText: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontSize: "max(0.75rem, 12px)",
        color: (theme.vars || theme).palette.text.secondary,
        "&.Mui-error": {
          color: (theme.vars || theme).palette.error.main,
        },
      }),
    },
  },

  // Ensure proper heading hierarchy accessibility
  MuiTypography: {
    defaultProps: {
      // Add component prop defaults to prevent heading skips
      variantMapping: {
        h1: "h1",
        h2: "h2",
        h3: "h3",
        h4: "h4",
        h5: "h5",
        h6: "h6",
      },
    },
  },

  MuiTablePagination: {
    styleOverrides: {
      actions: {
        display: "flex",
        gap: 8,
        marginRight: 6,
        [`& .${iconButtonClasses.root}`]: {
          minWidth: 0,
          width: 36,
          height: 36,
        },
      },
      select: ({ theme }) => ({
        // Improve contrast for accessibility
        color: (theme.vars || theme).palette.text.primary,
        backgroundColor: (theme.vars || theme).palette.background.paper,
        border: `1px solid ${(theme.vars || theme).palette.divider}`,
        borderRadius: (theme.vars || theme).shape.borderRadius,
        padding: "4px 8px",
        "&:focus": {
          borderColor: (theme.vars || theme).palette.primary.main,
          outline: theme.vars
            ? `2px solid color-mix(in srgb, ${theme.vars.palette.primary.main} 20%, transparent)`
            : `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          outlineOffset: "1px",
        },
        "&:hover": {
          borderColor: (theme.vars || theme).palette.primary.main,
        },
      }),
      selectLabel: ({ theme }) => ({
        // Ensure proper label styling for accessibility
        color: (theme.vars || theme).palette.text.primary,
        fontWeight: 500,
      }),
    },
  },

  MuiLink: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: (theme.vars || theme).palette.link.primary,
        textDecoration: "underline",
        textDecorationColor: "transparent",
        transition: theme.transitions.create(
          ["color", "text-decoration-color"],
          {
            duration: theme.transitions.duration.short,
          },
        ),
        "&:hover": {
          color: (theme.vars || theme).palette.link.hover,
          textDecorationColor: (theme.vars || theme).palette.link.hover,
        },
        "&:focus-visible": {
          outline: theme.vars
            ? `2px solid color-mix(in srgb, ${theme.vars.palette.link.primary} 30%, transparent)`
            : `2px solid ${alpha(theme.palette.link.primary, 0.3)}`,
          outlineOffset: "2px",
          borderRadius: "2px",
        },
      }),
    },
  },
};
