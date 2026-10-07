import { forwardRef, useCallback } from "react";

import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { toast } from "sonner";

import { CodeBlock } from "../code/CodeBlock";

import { ErrorCardShell } from "./ErrorCardShell";
import { summarizeMetadata } from "./summarizeMetadata";

interface ErrorWithCodeProps {
  id: string | number;
  message: string;
  metadata?: Record<string, any>;
}

export const ErrorWithStatusCode = forwardRef<
  HTMLDivElement,
  ErrorWithCodeProps
>((props, ref) => {
  const { id, message, metadata } = props;
  const { text, raw } = summarizeMetadata(metadata);

  const handleDismiss = useCallback(() => {
    toast.dismiss(id);
  }, [id]);

  return (
    <ErrorCardShell ref={ref} title={message} onDismiss={handleDismiss}>
      {text && (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            p: 1.5,
            borderRadius: "var(--template-surface-radius)",
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
          }}
        >
          <ErrorOutlineIcon color="error" fontSize="small" sx={{ mt: "1px" }} />
          <Typography
            variant="body2"
            color="error.dark"
            sx={{ wordBreak: "break-word", minWidth: 0 }}
          >
            {text}
          </Typography>
        </Box>
      )}

      {raw && (
        <Box sx={{ mt: 1.5 }}>
          <CodeBlock>{raw}</CodeBlock>
        </Box>
      )}
    </ErrorCardShell>
  );
});

ErrorWithStatusCode.displayName = "ErrorWithStatusCode";
