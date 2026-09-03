import { listItemButtonClasses } from "@mui/material/ListItemButton";
import { listSubheaderClasses } from "@mui/material/ListSubheader";
import { alpha, Theme, Components } from "@mui/material/styles";
import { svgIconClasses } from "@mui/material/SvgIcon";
import { typographyClasses } from "@mui/material/Typography";

import { grey } from "../themePrimitives";

export const sidebarCustomizations: Components<Theme> = {
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius,
        margin: "2px 6px",
        [`& .${svgIconClasses.root}`]: {
          color: theme.palette.text.secondary,
        },
        "&:hover": {
          backgroundColor: alpha(grey[900], 0.05),
          ...theme.applyStyles("dark", {
            backgroundColor: alpha(grey[100], 0.08),
          }),
        },
        "&.Mui-selected": {
          position: "relative",
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          ...theme.applyStyles("dark", {
            // In dark mode primary.main is near-white; use a neutral grey pill
            // at higher opacity so the active item reads clearly on the close
            // background instead of a washed-out light tint.
            backgroundColor: alpha(grey[100], 0.14),
          }),
          // Left accent bar marking the current page.
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: "55%",
            borderRadius: "0 3px 3px 0",
            backgroundColor: theme.palette.primary.main,
          },
          [`& .${svgIconClasses.root}`]: {
            color: theme.palette.primary.main,
          },
          "&:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            ...theme.applyStyles("dark", {
              backgroundColor: alpha(grey[100], 0.2),
            }),
          },
          "&:focus-visible": {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            ...theme.applyStyles("dark", {
              backgroundColor: alpha(grey[100], 0.14),
            }),
          },
        },
      }),
    },
  },
  MuiDrawer: {
    styleOverrides: {
      root: ({ theme }) => ({
        [`& .${listSubheaderClasses.root}`]: {
          lineHeight: 3,
        },
        [`& .${listItemButtonClasses.root}`]: {
          "&.Mui-selected": {
            [`& .${typographyClasses.root}`]: {
              color: (theme.vars ?? theme).palette.text.primary,
            },
          },
        },
      }),
      // Sidebar shares the grey canvas color with the header and content.
      paper: ({ theme }) => ({
        backgroundColor: (theme.vars ?? theme).palette.background.default,
      }),
    },
  },
};
