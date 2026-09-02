import { iconButtonClasses } from "@mui/material/IconButton";
import { inputLabelClasses } from "@mui/material/InputLabel";
import { outlinedInputClasses } from "@mui/material/OutlinedInput";
import { alpha, Theme, Components } from "@mui/material/styles";

import { brand } from "../themePrimitives";

export const formInputCustomizations: Components<Theme> = {
  MuiFormControl: {
    styleOverrides: {
      root: ({ theme }) => ({
        [`& .${inputLabelClasses.root}`]: {
          // Labels always float above the field (this app's form design).
          // MUI's default -9px parks the shrunk label's line box on the
          // border; on the compact 32px fields the glyphs would cross the
          // top border line. -16px lifts the label fully above the border
          // with a small gap (~2px under the baseline), and -18px on focus
          // clears the 2px focus outline ring as well.
          transform: "translate(4px, -16px) scale(0.75)",
          [`&.${outlinedInputClasses.focused}`]: {
            transform: "translate(4px, -18px) scale(0.75)",
          },
        },
        "& .MuiPickersInputBase-root": {
          marginTop: 6,
          border: `1px solid ${(theme.vars || theme).palette.divider}`,
          " .MuiPickersInputBase-sectionsContainer": {
            padding: "10px 0",
          },
          " .MuiPickersOutlinedInput-notchedOutline": {
            border: "none",
          },
          [`&.MuiPickersOutlinedInput-root.Mui-focused`]: {
            border: `1px solid ${(theme.vars || theme).palette.divider}`,
            outline: `3px solid ${alpha(brand[500], 0.5)}`,
            borderColor: brand[400],
            " .MuiPickersOutlinedInput-notchedOutline": {
              border: "none",
            },
          },
          [` .${iconButtonClasses.root}`]: {
            border: "none",
            height: "34px",
            width: "34px",
          },
        },
      }),
    },
  },
};
