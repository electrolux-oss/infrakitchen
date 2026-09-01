import { FC, ReactNode } from "react";

import { Box, SxProps, Theme } from "@mui/material";
import { CODE_FONT_FAMILY } from "../theme";

interface InlineCodeProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * Renders inline code with monospace font and a subtle background.
 */
export const InlineCode: FC<InlineCodeProps> = ({ children, sx }) => (
  <Box
    component="code"
    sx={{
      fontSize: "0.85em",
      fontFamily: CODE_FONT_FAMILY,
      backgroundColor: "var(--template-palette-action-hover)",
      borderRadius: "var(--template-surface-radius)",
      px: 0.75,
      py: 0.25,
      wordBreak: "break-all",
      ...sx,
    }}
  >
    {children}
  </Box>
);
