import { useEffect, useRef, useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import { IconButton, Tooltip } from "@mui/material";

interface CopyButtonProps {
  value: string | (() => string);
  label: string;
  variant?: "copy" | "link";
  onCopied?: () => void;
}

export const CopyButton = ({
  value,
  label,
  variant = "copy",
  onCopied,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        typeof value === "function" ? value() : value,
      );
    } catch {
      return;
    }
    setCopied(true);
    onCopied?.();
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied
    ? CheckIcon
    : variant === "link"
      ? LinkIcon
      : ContentCopyIcon;

  return (
    <Tooltip title={copied ? "Copied" : label}>
      <IconButton
        size="small"
        aria-label={copied ? "Copied to clipboard" : label}
        onClick={() => void handleCopy()}
        sx={{ p: 0.25, opacity: copied ? 1 : 0.6 }}
      >
        <Icon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
};
