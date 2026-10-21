import { forwardRef, useCallback } from "react";

import { toast } from "sonner";

import { CodeBlock } from "../code/CodeBlock";

import { ErrorCardShell } from "./ErrorCardShell";
import { summarizeMetadata } from "./summarizeMetadata";

interface DefaultErrorProps {
  id: string | number;
  title: string;
  /** Error details shown below the title. */
  details?: string;
  metadata?: Record<string, any>;
}

export const DefaultError = forwardRef<HTMLDivElement, DefaultErrorProps>(
  (props, ref) => {
    const { id, title, details, metadata } = props;
    const { text, raw } = summarizeMetadata(metadata);

    const handleDismiss = useCallback(() => {
      toast.dismiss(id);
    }, [id]);

    return (
      <ErrorCardShell ref={ref} title={title} onDismiss={handleDismiss}>
        {[details, text].filter(Boolean).map((line) => (
          <p
            key={line}
            className="m-0 min-w-0 pl-8 text-body2 [word-break:break-word] text-fg"
          >
            {line}
          </p>
        ))}

        {raw && (
          <div className="mt-3">
            <CodeBlock>{raw}</CodeBlock>
          </div>
        )}
      </ErrorCardShell>
    );
  },
);

DefaultError.displayName = "DefaultError";
