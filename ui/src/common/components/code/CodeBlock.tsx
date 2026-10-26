import { FC, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { HeroCheckIcon, HeroDocumentDuplicateIcon } from "../../../icons";
import { Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { notifyError } from "../../hooks/useNotification";
import { copyToClipboard } from "../../utils/clipboard";

interface CodeBlockProps {
  children: ReactNode;
  /** Disables the copy button; copy is enabled by default. */
  disableCopy?: boolean;
  className?: string;
}

export const CodeBlock: FC<CodeBlockProps> = ({
  children,
  disableCopy = false,
  className,
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
    <div className="relative">
      <pre
        ref={preRef}
        className={cn(
          "m-0 overflow-auto rounded-code bg-hover p-2 pr-6 font-mono text-[0.75rem] [word-break:break-word] whitespace-pre-wrap",
          className,
        )}
      >
        {children}
      </pre>
      {!disableCopy && (
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <button
            className="absolute top-1 right-1 inline-flex cursor-pointer items-center rounded-[4px] border-0 p-0.5 leading-[0] text-fg-muted opacity-65 [background:none] [transition:opacity_120ms_ease] hover:bg-selected hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary [&_svg]:text-[1rem]"
            type="button"
            aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            onClick={handleCopy}
          >
            {copied ? <HeroCheckIcon /> : <HeroDocumentDuplicateIcon />}
          </button>
        </Tooltip>
      )}
    </div>
  );
};
