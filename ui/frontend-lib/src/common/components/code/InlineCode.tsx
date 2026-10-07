import { FC, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, SxProps, Theme, Tooltip } from "@mui/material";

import { CODE_FONT_FAMILY } from "../../theme";

interface InlineCodeProps {
  children: ReactNode;
  /** Disables the copy button; copy is enabled by default. */
  disableCopy?: boolean;
  sx?: SxProps<Theme>;
}

export const InlineCode: FC<InlineCodeProps> = ({
  children,
  disableCopy = false,
  sx,
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(async () => {
    const text = textRef.current?.textContent ?? "";
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
    <Box
      component="code"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: "0.85em",
        fontFamily: CODE_FONT_FAMILY,
        backgroundColor: "var(--template-palette-action-hover)",
        borderRadius: "var(--template-code-radius)",
        px: 0.75,
        py: 0.25,
        wordBreak: "break-all",
        ...sx,
      }}
    >
      <span ref={textRef}>{children}</span>
      {!disableCopy && (
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <Box
            component="button"
            type="button"
            aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            onClick={handleCopy}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
              padding: 0,
              border: "none",
              background: "none",
              color: "inherit",
              opacity: 0.65,
              cursor: "pointer",
              lineHeight: 0,
              transition: "opacity 120ms ease",
              "&:hover": {
                opacity: 1,
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "1px",
              },
              "& svg": {
                fontSize: "0.95em",
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
