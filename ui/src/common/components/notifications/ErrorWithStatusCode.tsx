import { forwardRef, useCallback } from "react";

import { toast } from "sonner";

import { HeroExclamationCircleIcon } from "../../../icons";
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
        <div className="flex gap-2 rounded-surface bg-error/8 p-3">
          <HeroExclamationCircleIcon
            className="mt-0.25"
            color="error"
            fontSize="small"
          />
          <p className="m-0 min-w-0 text-body2 [word-break:break-word] text-error-dark">
            {text}
          </p>
        </div>
      )}

      {raw && (
        <div className="mt-3">
          <CodeBlock>{raw}</CodeBlock>
        </div>
      )}
    </ErrorCardShell>
  );
});

ErrorWithStatusCode.displayName = "ErrorWithStatusCode";
