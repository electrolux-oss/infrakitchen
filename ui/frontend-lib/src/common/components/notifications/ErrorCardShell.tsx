import { forwardRef, ReactNode } from "react";

import CloseIcon from "@mui/icons-material/Close";
import { Box, Card, IconButton, Typography } from "@mui/material";

interface ErrorCardShellProps {
  title: ReactNode;
  onDismiss: () => void;
  children?: ReactNode;
}

/**
 * Shared visual shell for toast-based error cards: a plain white, rounded,
 * shadowed card with a bold title and close button, and an optional body.
 */
export const ErrorCardShell = forwardRef<HTMLDivElement, ErrorCardShellProps>(
  ({ title, onDismiss, children }, ref) => (
    <div ref={ref} role="alert">
      <Card
        sx={{
          width: "min(480px, 92vw)",
          borderRadius: "var(--template-surface-radius)",
          boxShadow: 8,
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 1,
            }}
          >
            <Typography
              variant="subtitle1"
              color="primary"
              sx={{ fontWeight: 700, minWidth: 0 }}
            >
              {title}
            </Typography>
            <IconButton size="small" onClick={onDismiss} sx={{ p: 0.25, mt: -0.25, mr: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          {children && <Box sx={{ mt: 0.5 }}>{children}</Box>}
        </Box>
      </Card>
    </div>
  ),
);

ErrorCardShell.displayName = "ErrorCardShell";
