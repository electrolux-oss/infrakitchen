import { FC, ReactNode } from "react";

import { Box, SxProps, Theme } from "@mui/material";

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
      fontFamily: "'Roboto Mono', monospace",
      backgroundColor: "rgba(0, 0, 0, 0.05)",
      borderRadius: "3px",
      px: 0.75,
      py: 0.25,
      wordBreak: "break-all",
      ...sx,
    }}
  >
    {children}
  </Box>
);
