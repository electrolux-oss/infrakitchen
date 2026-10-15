import { forwardRef, ReactNode } from "react";

import { CloseIcon } from "../../../icons/material";
import { IconButton, Card } from "../../../ui";

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
      <Card className="w-[min(480px,92vw)] overflow-hidden rounded-surface shadow-[var(--ik-shadow-8)]">
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h6 className="m-0 min-w-0 text-subtitle1 font-bold text-primary">
              {title}
            </h6>
            <IconButton
              className="-mt-0.5 -mr-1 p-0.5"
              size="small"
              onClick={onDismiss}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
          {children && <div className="mt-1">{children}</div>}
        </div>
      </Card>
    </div>
  ),
);

ErrorCardShell.displayName = "ErrorCardShell";
