import { forwardRef, ReactNode } from "react";

import { HeroExclamationCircleIcon, HeroXMarkIcon } from "../../../icons";
import { IconButton, Card } from "../../../ui";

interface ErrorCardShellProps {
  title: ReactNode;
  onDismiss: () => void;
  children?: ReactNode;
}

/**
 * Shared visual shell for toast-based error cards: a rounded, shadowed card
 * tinted like the error Alert, with an icon, a bold title, a close button and an optional body.
 */
export const ErrorCardShell = forwardRef<HTMLDivElement, ErrorCardShellProps>(
  ({ title, onDismiss, children }, ref) => (
    <div ref={ref} role="alert">
      <Card className="w-[min(480px,92vw)] overflow-hidden rounded-surface border-tint-red-300/50 bg-tint-red-100 shadow-[var(--ik-shadow-8)] dark:border-tint-red-800/50 dark:bg-tint-red-900">
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <HeroExclamationCircleIcon className="mt-0.5 shrink-0 text-tint-red-400" />
            <h6 className="m-0 min-w-0 grow text-body2 font-semibold text-fg">
              {title}
            </h6>
            <IconButton
              className="-mt-0.5 -mr-1 p-0.5"
              size="small"
              onClick={onDismiss}
            >
              <HeroXMarkIcon fontSize="small" />
            </IconButton>
          </div>
          {children && <div className="mt-1">{children}</div>}
        </div>
      </Card>
    </div>
  ),
);

ErrorCardShell.displayName = "ErrorCardShell";
