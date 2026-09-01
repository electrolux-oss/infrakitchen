import CheckBoxOutlineBlankRoundedIcon from "@mui/icons-material/CheckBoxOutlineBlankRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { outlinedInputClasses } from "@mui/material/OutlinedInput";
import { alpha, Theme, Components } from "@mui/material/styles";
import { svgIconClasses } from "@mui/material/SvgIcon";
import { toggleButtonClasses } from "@mui/material/ToggleButton";
import { toggleButtonGroupClasses } from "@mui/material/ToggleButtonGroup";

import { grey, brand } from "../themePrimitives";

import { dropdownItemStyle, dropdownPaperStyle } from "./dataDisplay";

export const inputsCustomizations: Components<Theme> = {
  MuiButtonBase: {
    defaultProps: {
      disableTouchRipple: true,
      disableRipple: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        boxSizing: "border-box",
        transition: "all 100ms ease-in",
        "&:focus-visible": {
          outline: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
          outlineOffset: "2px",
        },
      }),
    },
  },
  MuiButton: {
    defaultProps: {
      size: "small",
      variant: "outlined",
    },
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: "none",
        borderRadius: (theme.vars || theme).shape.borderRadius,
        textTransform: "none",
        variants: [
          {
            props: {
              size: "small",
            },
            style: {
              height: "2.25rem",
              padding: "8px 12px",
            },
          },
          {
            props: {
              size: "medium",
            },
            style: {
              height: "2.5rem", // 40px
            },
          },
          {
            // Destructive action button (Destroy / Delete / Disable / Cascade
            // Destroy / …). Single centralized definition, small + solid red.
            props: {
              color: "error",
              variant: "contained",
            },
            style: {
              height: "2.25rem",
              padding: "8px 12px",
              minHeight: 0,
              color: "#fff",
              backgroundColor: (theme.vars || theme).palette.error.main,
              "&:hover": {
                backgroundColor: (theme.vars || theme).palette.error.dark,
              },
              "&:active": {
                backgroundColor: (theme.vars || theme).palette.error.main,
              },
              ...theme.applyStyles("dark", {
                color: "#fff",
                backgroundColor: (theme.vars || theme).palette.error.dark,
                "&:hover": {
                  backgroundColor: (theme.vars || theme).palette.error.main,
                },
                "&:active": {
                  backgroundColor: (theme.vars || theme).palette.error.dark,
                },
              }),
            },
          },
          {
            props: {
              color: "primary",
              variant: "contained",
            },
            style: {
              color: "#fff",
              backgroundColor: grey[900],
              "&:hover": {
                backgroundColor: "#202020",
              },
              "&:active": {
                backgroundColor: grey[800],
              },
              ...theme.applyStyles("dark", {
                color: grey[900],
                backgroundColor: grey[50],
                "&:hover": {
                  backgroundColor: "#EDEDED",
                },
                "&:active": {
                  backgroundColor: grey[300],
                },
              }),
            },
          },
          {
            props: {
              color: "secondary",
              variant: "contained",
            },
            style: {
              color: "#fff",
              backgroundColor: grey[900],
              "&:hover": {
                backgroundColor: "#202020",
              },
              "&:active": {
                backgroundColor: grey[800],
              },
              ...theme.applyStyles("dark", {
                color: grey[900],
                backgroundColor: grey[50],
                "&:hover": {
                  backgroundColor: "#EDEDED",
                },
                "&:active": {
                  backgroundColor: grey[300],
                },
              }),
            },
          },
          {
            props: {
              variant: "outlined",
            },
            style: {
              color: (theme.vars || theme).palette.text.primary,
              border: "1px solid",
              borderColor: grey[300],
              // White pill on the grey canvas; colored variants (contained
              // primary/error/…) keep their own background.
              backgroundColor: (theme.vars || theme).palette.background.paper,
              "&:hover": {
                backgroundColor: grey[100],
                borderColor: grey[400],
              },
              "&:active": {
                backgroundColor: grey[200],
              },
              ...theme.applyStyles("dark", {
                backgroundColor: "transparent",
                borderColor: grey[600],
                "&:hover": {
                  backgroundColor: alpha(grey[100], 0.08),
                  borderColor: grey[500],
                },
                "&:active": {
                  backgroundColor: alpha(grey[100], 0.14),
                },
              }),
            },
          },
          {
            props: {
              color: "secondary",
              variant: "outlined",
            },
            style: {
              color: (theme.vars || theme).palette.text.primary,
              border: "1px solid",
              borderColor: grey[300],
              backgroundColor: (theme.vars || theme).palette.background.paper,
              "&:hover": {
                backgroundColor: grey[100],
                borderColor: grey[400],
              },
              "&:active": {
                backgroundColor: grey[200],
              },
              ...theme.applyStyles("dark", {
                color: (theme.vars || theme).palette.text.primary,
                backgroundColor: "transparent",
                borderColor: grey[600],
                "&:hover": {
                  backgroundColor: alpha(grey[100], 0.08),
                  borderColor: grey[500],
                },
                "&:active": {
                  backgroundColor: alpha(grey[100], 0.14),
                },
              }),
            },
          },
          {
            props: {
              variant: "text",
            },
            style: {
              color: grey[600],
              "&:hover": {
                backgroundColor: grey[100],
              },
              "&:active": {
                backgroundColor: grey[200],
              },
              ...theme.applyStyles("dark", {
                color: grey[300],
                "&:hover": {
                  backgroundColor: alpha(grey[100], 0.08),
                },
                "&:active": {
                  backgroundColor: alpha(grey[100], 0.14),
                },
              }),
            },
          },
          {
            props: {
              color: "secondary",
              variant: "text",
            },
            style: {
              color: grey[700],
              "&:hover": {
                backgroundColor: grey[100],
              },
              "&:active": {
                backgroundColor: grey[200],
              },
              ...theme.applyStyles("dark", {
                color: grey[200],
                "&:hover": {
                  backgroundColor: alpha(grey[100], 0.08),
                },
                "&:active": {
                  backgroundColor: alpha(grey[100], 0.14),
                },
              }),
            },
          },
        ],
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: "none",
        borderRadius: (theme.vars || theme).shape.borderRadius,
        textTransform: "none",
        fontWeight: theme.typography.fontWeightMedium,
        letterSpacing: 0,
        color: (theme.vars || theme).palette.text.secondary,
        border: "none",
        backgroundColor: "transparent",
        transition:
          "background-color 120ms ease-in-out, color 120ms ease-in-out",
        "&:hover": {
          backgroundColor: (theme.vars || theme).palette.action.hover,
        },
        "&:active": {
          backgroundColor: (theme.vars || theme).palette.action.selected,
        },
        variants: [
          {
            props: {
              size: "small",
            },
            style: {
              width: "2.25rem",
              height: "2.25rem",
              padding: "0.25rem",
              [`& .${svgIconClasses.root}`]: { fontSize: "1rem" },
            },
          },
          {
            props: {
              size: "medium",
            },
            style: {
              width: "2.5rem",
              height: "2.5rem",
            },
          },
        ],
      }),
    },
  },
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: (theme.vars || theme).shape.borderRadius,
        [`& .${toggleButtonGroupClasses.selected}`]: {
          color: grey[900],
        },
        ...theme.applyStyles("dark", {
          [`& .${toggleButtonGroupClasses.selected}`]: {
            color: "#fff",
          },
        }),
      }),
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: "12px 16px",
        textTransform: "none",
        borderRadius: (theme.vars || theme).shape.borderRadius,
        fontWeight: 500,
        ...theme.applyStyles("dark", {
          color: grey[300],
          [`&.${toggleButtonClasses.selected}`]: {
            color: grey[50],
          },
        }),
      }),
    },
  },
  MuiCheckbox: {
    defaultProps: {
      disableRipple: true,
      icon: (
        <CheckBoxOutlineBlankRoundedIcon
          sx={{ color: "hsla(210, 0%, 0%, 0.0)" }}
        />
      ),
      checkedIcon: <CheckRoundedIcon sx={{ height: 14, width: 14 }} />,
      indeterminateIcon: <RemoveRoundedIcon sx={{ height: 14, width: 14 }} />,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        margin: 10,
        height: 16,
        width: 16,
        borderRadius: 5,
        border: "1px solid ",
        borderColor: alpha(grey[300], 0.8),
        boxShadow: "0 0 0 1.5px hsla(210, 0%, 0%, 0.04) inset",
        backgroundColor: alpha(grey[100], 0.4),
        transition: "border-color, background-color, 120ms ease-in",
        "&:hover": {
          borderColor: brand[300],
        },
        "&.Mui-focusVisible": {
          outline: `2px solid ${alpha(grey[900], 0.18)}`,
          outlineOffset: "2px",
          borderColor: grey[700],
        },
        "&.Mui-checked": {
          color: "white",
          backgroundColor: grey[900],
          borderColor: grey[900],
          boxShadow: `none`,
          "&:hover": {
            backgroundColor: grey[700],
          },
        },
        ...theme.applyStyles("dark", {
          borderColor: alpha(grey[700], 0.8),
          boxShadow: "0 0 0 1.5px hsl(210, 0%, 0%) inset",
          backgroundColor: alpha(grey[900], 0.8),
          "&:hover": {
            borderColor: brand[300],
          },
          "&.Mui-focusVisible": {
            borderColor: brand[400],
            outline: `3px solid ${alpha(brand[500], 0.5)}`,
            outlineOffset: "2px",
          },
        }),
      }),
    },
  },
  MuiAutocomplete: {
    styleOverrides: {
      root: ({ theme }) => ({
        "& .MuiOutlinedInput-root": {
          display: "flex",
          alignItems: "center",
          minHeight: "2.5rem",
          height: "auto",
          padding: "7px 12px",
          "& .MuiAutocomplete-input": {
            padding: 0,
          },
          "& .MuiAutocomplete-endAdornment": {
            right: 0,
            "& .MuiButtonBase-root": {
              border: 0,
              height: "90%",
              backgroundColor: "transparent",
              color: (theme.vars || theme).palette.text.secondary,
              "&:hover": {
                backgroundColor: "transparent",
                color: (theme.vars || theme).palette.text.primary,
              },
            },
          },
        },
      }),
      paper: dropdownPaperStyle,
      listbox: ({ theme }) => ({
        padding: "8px",
        "& .MuiAutocomplete-option": dropdownItemStyle({ theme }),
      }),
    },
  },
  MuiInputBase: {
    styleOverrides: {
      root: {
        border: "none",
      },
      input: {
        "&::placeholder": {
          opacity: 0.7,
          color: grey[500],
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      input: {
        padding: 0,
      },
      root: ({ theme }) => ({
        padding: "8px 12px",
        color: (theme.vars || theme).palette.text.primary,
        borderRadius: (theme.vars || theme).shape.borderRadius,
        border: `1px solid ${(theme.vars || theme).palette.divider}`,
        // White inputs so they stay distinct from the grey canvas background.
        backgroundColor: (theme.vars || theme).palette.background.paper,
        transition: "border 120ms ease-in",
        "&:hover": {
          borderColor: grey[400],
        },
        [`&.${outlinedInputClasses.focused}`]: {
          outline: `2px solid ${alpha(grey[900], 0.15)}`,
          borderColor: grey[800],
        },
        ...theme.applyStyles("dark", {
          "&:hover": {
            borderColor: grey[500],
          },
        }),
        variants: [
          {
            props: {
              size: "small",
              multiline: false,
            },
            style: {
              height: "2.25rem",
            },
          },
          {
            props: {
              size: "medium",
              multiline: false,
            },
            style: {
              height: "2.5rem",
            },
          },
        ],
      }),
      notchedOutline: {
        border: "none",
      },
    },
  },
  MuiInputAdornment: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: (theme.vars || theme).palette.grey[500],
        ...theme.applyStyles("dark", {
          color: (theme.vars || theme).palette.grey[400],
        }),
      }),
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: ({ theme }) => ({
        typography: theme.typography.caption,
        marginBottom: 8,
      }),
    },
  },
};
