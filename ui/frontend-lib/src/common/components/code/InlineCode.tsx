import { FC, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { CheckIcon, ContentCopyIcon } from "../../../icons/material";
import { Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { notifyError } from "../../hooks/useNotification";
import { copyToClipboard } from "../../utils/clipboard";

interface InlineCodeProps {
  children: ReactNode;
  /** Disables the copy button; copy is enabled by default. */
  disableCopy?: boolean;
  className?: string;
}

export const InlineCode: FC<InlineCodeProps> = ({
  children,
  disableCopy = false,
  className,
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
      await copyToClipboard(text);
    } catch (error) {
      notifyError(error);
      return;
    }
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <code
      className={cn(
        "inline-flex items-center gap-1 rounded-code bg-hover px-1.5 py-0.5 font-mono text-[0.85em] break-all",
        className,
      )}
    >
      <span ref={textRef}>{children}</span>
      {!disableCopy && (
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <button
            className="inline-flex shrink-0 cursor-pointer items-center border-0 p-0 leading-[0] text-inherit opacity-65 [background:none] [transition:opacity_120ms_ease] hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary [&_svg]:text-[0.95em]"
            type="button"
            aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            onClick={handleCopy}
          >
            {copied ? <CheckIcon /> : <ContentCopyIcon />}
          </button>
        </Tooltip>
      )}
    </code>
  );
};
