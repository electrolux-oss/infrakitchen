import { Theme, alpha, Components } from "@mui/material/styles";

import { grey, orange } from "../themePrimitives";

export const feedbackCustomizations: Components<Theme> = {
  MuiSnackbarContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        padding: "6px 14px",
        boxShadow: theme.shadows[4],
        fontSize: theme.typography.body2.fontSize,
        fontWeight: 500,
        lineHeight: 1.4,
        maxWidth: 480,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1.5),
        "&.notistack-MuiContent-success": {
          background: (theme.vars || theme).palette.success.main,
          color: (theme.vars || theme).palette.common.white,
        },
        "&.notistack-MuiContent-error": {
          background: (theme.vars || theme).palette.error.main,
          color: (theme.vars || theme).palette.common.white,
        },
        "&.notistack-MuiContent-warning": {
          background: (theme.vars || theme).palette.warning.main,
          color: (theme.vars || theme).palette.common.black,
        },
        "&.notistack-MuiContent-info": {
          background: (theme.vars || theme).palette.info.main,
          color: (theme.vars || theme).palette.common.white,
        },
        "& .MuiButton-root": {
          color: "inherit",
          textDecoration: "underline",
        },
      }),
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        backgroundColor: orange[100],
        color: (theme.vars || theme).palette.text.primary,
        border: `1px solid ${alpha(orange[300], 0.5)}`,
        "& .MuiAlert-icon": {
          color: orange[500],
        },
        ...theme.applyStyles("dark", {
          backgroundColor: `${alpha(orange[900], 0.5)}`,
          border: `1px solid ${alpha(orange[800], 0.5)}`,
        }),
      }),
    },
  },
  MuiDialog: {
    styleOverrides: {
      root: ({ theme }) => ({
        "& .MuiDialog-paper": {
          borderRadius: "10px",
          border: "1px solid",
          borderColor: (theme.vars || theme).palette.divider,
        },
      }),
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: 8,
        borderRadius: 8,
        backgroundColor: grey[200],
        ...theme.applyStyles("dark", {
          backgroundColor: grey[800],
        }),
      }),
    },
  },
};
