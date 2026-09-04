import { FC, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, SxProps, Theme, Tooltip } from "@mui/material";

import { CODE_FONT_FAMILY } from "../theme";

interface CodeBlockProps {
  children: ReactNode;
  /** Disables the copy button; copy is enabled by default. */
  disableCopy?: boolean;
  sx?: SxProps<Theme>;
}

export const CodeBlock: FC<CodeBlockProps> = ({
  children,
  disableCopy = false,
  sx,
}) => {
  const preRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(async () => {
    const text = preRef.current?.textContent ?? "";
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="pre"
        ref={preRef}
        sx={{
          m: 0,
          p: 1,
          pr: 3,
          fontSize: "0.75rem",
          fontFamily: CODE_FONT_FAMILY,
          bgcolor: "action.hover",
          borderRadius: "var(--template-code-radius)",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          ...sx,
        }}
      >
        {children}
      </Box>
      {!disableCopy && (
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <Box
            component="button"
            type="button"
            aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            onClick={handleCopy}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              display: "inline-flex",
              alignItems: "center",
              padding: "2px",
              border: "none",
              borderRadius: "4px",
              background: "none",
              color: "text.secondary",
              opacity: 0.65,
              cursor: "pointer",
              lineHeight: 0,
              transition: "opacity 120ms ease",
              "&:hover": {
                opacity: 1,
                backgroundColor: "action.selected",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "1px",
              },
              "& svg": {
                fontSize: "1rem",
              },
            }}
          >
            {copied ? <CheckIcon /> : <ContentCopyIcon />}
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};
