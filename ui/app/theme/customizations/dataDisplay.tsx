import { buttonBaseClasses } from "@mui/material/ButtonBase";
import { chipClasses } from "@mui/material/Chip";
import { iconButtonClasses } from "@mui/material/IconButton";
import { Theme, alpha, Components } from "@mui/material/styles";
import { svgIconClasses } from "@mui/material/SvgIcon";
import { typographyClasses } from "@mui/material/Typography";

import { grey, red, green, orange } from "../themePrimitives";

/**
 * Shared dropdown popover/leaf styles used by both Menu/Select and
 * Autocomplete lists. Editing these updates every dropdown at once, so the
 * lists stay visually consistent (paper, radius, hover) without duplication.
 */
export const dropdownPaperStyle = ({ theme }: { theme: Theme }) => ({
  mt: 0.5,
  py: 0.5,
  borderRadius: "10px",
  boxShadow: theme.shadows[4],
});

/**
 * Selected-state background colors shared by Menu/Select items (&.Mui-selected)
 * and Autocomplete options (&[aria-selected="true"]). Keeping them in one place
 * guarantees the selected look stays identical across every dropdown type.
 */
export const dropdownItemStyle = ({ theme }: { theme: Theme }) => {
  const primary = (theme.vars || theme).palette.primary.main;
  const { selectedOpacity, hoverOpacity, focusOpacity } = (theme.vars || theme)
    .palette.action;
  const selected = () => theme.alpha(primary, selectedOpacity);
  const selectedHover = () =>
    theme.alpha(primary, `${selectedOpacity} + ${hoverOpacity}`);
  const selectedFocusVisible = () =>
    theme.alpha(primary, `${selectedOpacity} + ${focusOpacity}`);

  return {
    borderRadius: (theme.vars || theme).shape.borderRadius,
    mx: 0.5,
    "&:hover": {
      backgroundColor: (theme.vars || theme).palette.action.hover,
    },
    // Menu / Select dropdown items
    "&.Mui-selected": {
      backgroundColor: selected(),
      "&.Mui-focusVisible": {
        backgroundColor: selectedFocusVisible(),
      },
      "&:hover": {
        backgroundColor: selectedHover(),
        "@media (hover: none)": {
          backgroundColor: selected(),
        },
      },
    },
    // Autocomplete options use the dropdown item colors
    '&[aria-selected="true"]': {
      backgroundColor: selected(),
      "&.Mui-focusVisible": {
        backgroundColor: selectedFocusVisible(),
      },
      "&.Mui-focused": {
        backgroundColor: selectedHover(),
        "@media (hover: none)": {
          backgroundColor: selected(),
        },
      },
    },
  };
};

export const dataDisplayCustomizations: Components<Theme> = {
  MuiList: {
    styleOverrides: {
      root: {
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      },
    },
  },
  MuiListItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        [`& .${svgIconClasses.root}`]: {
          width: "1rem",
          height: "1rem",
          color: (theme.vars || theme).palette.text.secondary,
        },
        [`& .${typographyClasses.root}`]: {
          fontWeight: 500,
        },
        [`& .${buttonBaseClasses.root}`]: {
          display: "flex",
          gap: 8,
          padding: "2px 8px",
          borderRadius: (theme.vars || theme).shape.borderRadius,
          opacity: 0.7,
          "&.Mui-selected": {
            opacity: 1,
            backgroundColor: alpha(grey[900], 0.06),
            ...theme.applyStyles("dark", {
              backgroundColor: alpha(grey[100], 0.12),
            }),
            [`& .${svgIconClasses.root}`]: {
              color: (theme.vars || theme).palette.text.primary,
            },
            "&:focus-visible": {
              backgroundColor: alpha(grey[900], 0.06),
              ...theme.applyStyles("dark", {
                backgroundColor: alpha(grey[100], 0.12),
              }),
            },
            "&:hover": {
              backgroundColor: alpha(grey[900], 0.09),
              ...theme.applyStyles("dark", {
                backgroundColor: alpha(grey[100], 0.16),
              }),
            },
          },
          "&:focus-visible": {
            backgroundColor: "transparent",
          },
        },
      }),
    },
  },
  MuiListItemText: {
    styleOverrides: {
      primary: ({ theme }) => ({
        fontSize: theme.typography.body2.fontSize,
        fontWeight: 500,
        lineHeight: theme.typography.body2.lineHeight,
      }),
      secondary: ({ theme }) => ({
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
      }),
    },
  },
  MuiListSubheader: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: "transparent",
        padding: "4px 8px",
        fontSize: theme.typography.caption.fontSize,
        fontWeight: 500,
        lineHeight: theme.typography.caption.lineHeight,
      }),
    },
  },
  MuiListItemIcon: {
    styleOverrides: {
      root: {
        minWidth: 0,
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) => ({
        minWidth: 200,
        ...dropdownPaperStyle({ theme }),
      }),
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      // MUI's MenuItem default is 16px body1; pin dropdowns to the same 14px
      // body2 text as the rest of the UI. This also cascades into the DataGrid
      // footer's Rows-per-page items (MuiTablePagination-menuItem), which are
      // built on MenuItem and inherit these overrides.
      root: ({ theme }) => ({
        ...dropdownItemStyle({ theme }),
        fontSize: theme.typography.body2.fontSize,
        lineHeight: theme.typography.body2.lineHeight,
      }),
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: (theme.vars || theme).palette.background.paper,
        color: (theme.vars || theme).palette.text.primary,
        border: "1px solid",
        borderColor: (theme.vars || theme).palette.divider,
        borderRadius: (theme.vars || theme).shape.borderRadius,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: 500,
        lineHeight: 1.4,
        padding: "6px 10px",
        boxShadow: theme.shadows[4],
      }),
      arrow: ({ theme }) => ({
        color: (theme.vars || theme).palette.background.paper,
        "&::before": {
          backgroundColor: (theme.vars || theme).palette.background.paper,
          border: "1px solid",
          borderColor: (theme.vars || theme).palette.divider,
          boxSizing: "border-box",
        },
      }),
    },
  },
  MuiChip: {
    defaultProps: {
      size: "small",
    },
    styleOverrides: {
      root: ({ theme }) => ({
        border: "1px solid",
        borderRadius: (theme.vars || theme).shape.borderRadius,
        [`& .${chipClasses.label}`]: {
          fontWeight: 600,
        },
        variants: [
          {
            props: {
              color: "default",
            },
            style: {
              borderColor: grey[200],
              backgroundColor: grey[100],
              [`& .${chipClasses.label}`]: {
                color: grey[500],
              },
              [`& .${chipClasses.icon}`]: {
                color: grey[500],
              },
              ...theme.applyStyles("dark", {
                borderColor: grey[700],
                backgroundColor: grey[800],
                [`& .${chipClasses.label}`]: {
                  color: grey[300],
                },
                [`& .${chipClasses.icon}`]: {
                  color: grey[300],
                },
              }),
            },
          },
          {
            props: {
              color: "success",
            },
            style: {
              borderColor: green[200],
              backgroundColor: green[50],
              [`& .${chipClasses.label}`]: {
                color: green[500],
              },
              [`& .${chipClasses.icon}`]: {
                color: green[500],
              },
              ...theme.applyStyles("dark", {
                borderColor: green[800],
                backgroundColor: green[900],
                [`& .${chipClasses.label}`]: {
                  color: green[300],
                },
                [`& .${chipClasses.icon}`]: {
                  color: green[300],
                },
              }),
            },
          },
          {
            props: {
              color: "error",
            },
            style: {
              borderColor: red[100],
              backgroundColor: red[50],
              [`& .${chipClasses.label}`]: {
                color: red[500],
              },
              [`& .${chipClasses.icon}`]: {
                color: red[500],
              },
              ...theme.applyStyles("dark", {
                borderColor: red[800],
                backgroundColor: red[900],
                [`& .${chipClasses.label}`]: {
                  color: red[200],
                },
                [`& .${chipClasses.icon}`]: {
                  color: red[300],
                },
              }),
            },
          },
          {
            props: {
              color: "warning",
            },
            style: {
              borderColor: orange[200],
              backgroundColor: orange[50],
              [`& .${chipClasses.label}`]: {
                color: orange[500],
              },
              [`& .${chipClasses.icon}`]: {
                color: orange[500],
              },
              ...theme.applyStyles("dark", {
                borderColor: orange[800],
                backgroundColor: orange[900],
                [`& .${chipClasses.label}`]: {
                  color: orange[300],
                },
                [`& .${chipClasses.icon}`]: {
                  color: orange[300],
                },
              }),
            },
          },
          {
            props: {
              color: "info",
            },
            style: {
              borderColor: "hsl(211, 92%, 85%)",
              backgroundColor: "hsl(211, 92%, 96%)",
              [`& .${chipClasses.label}`]: {
                color: "hsl(211, 92%, 45%)",
              },
              [`& .${chipClasses.icon}`]: {
                color: "hsl(211, 92%, 45%)",
              },
              ...theme.applyStyles("dark", {
                borderColor: "hsl(211, 92%, 32%)",
                backgroundColor: "hsl(211, 92%, 12%)",
                [`& .${chipClasses.label}`]: {
                  color: "hsl(211, 92%, 70%)",
                },
                [`& .${chipClasses.icon}`]: {
                  color: "hsl(211, 92%, 70%)",
                },
              }),
            },
          },
          {
            props: { size: "small" },
            style: {
              maxHeight: 20,
              [`& .${chipClasses.label}`]: {
                fontSize: theme.typography.caption.fontSize,
              },
              [`& .${svgIconClasses.root}`]: {
                fontSize: theme.typography.caption.fontSize,
              },
            },
          },
          {
            props: { size: "medium" },
            style: {
              [`& .${chipClasses.label}`]: {
                fontSize: theme.typography.caption.fontSize,
              },
            },
          },
        ],
      }),
    },
  },
  MuiTablePagination: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
      }),
      toolbar: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
      }),
      selectLabel: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
      }),
      displayedRows: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
      }),
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
    },
  },
  MuiSelect: {
    defaultProps: {
      // Compact dropdowns by default; components only opt into medium when
      // they need a larger control.
      size: "small",
    },
    styleOverrides: {
      icon: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
        "&:hover": {
          color: (theme.vars || theme).palette.text.primary,
        },
      }),
    },
  },
  MuiIcon: {
    defaultProps: {
      fontSize: "small",
    },
    styleOverrides: {
      root: {
        variants: [
          {
            props: {
              fontSize: "small",
            },
            style: {
              fontSize: "1rem",
            },
          },
        ],
      },
    },
  },
};
