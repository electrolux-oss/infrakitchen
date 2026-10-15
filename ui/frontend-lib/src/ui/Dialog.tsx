import {
  createContext,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  SyntheticEvent,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";

import { createPortal } from "react-dom";

import { cn } from "../utils/cn";

import { isTopOverlay, popOverlay, pushOverlay } from "./overlayStack";

export type DialogCloseReason = "backdropClick" | "escapeKeyDown";

export interface DialogProps {
  open: boolean;
  onClose?: (event: SyntheticEvent, reason: DialogCloseReason) => void;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  /** Stretch to maxWidth instead of fitting the content. */
  fullWidth?: boolean;
  fullScreen?: boolean;
  className?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  children?: ReactNode;
}

const MAX_WIDTH = {
  xs: "max-w-[444px]",
  sm: "max-w-[600px]",
  md: "max-w-[900px]",
  lg: "max-w-[1200px]",
  xl: "max-w-[1536px]",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const DialogTitleIdContext = createContext<string | undefined>(undefined);

/**
 * Modal dialog on daisyUI's `modal`. Renders into document.body, closes on
 * Escape and backdrop click (reporting which), keeps Tab focus inside, locks
 * page scroll and restores focus on close.
 */
export function Dialog({
  open,
  onClose,
  maxWidth = "sm",
  fullWidth = false,
  fullScreen = false,
  className,
  children,
  ...aria
}: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const boxRef = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    pushOverlay(id);

    // Focus the dialog itself unless a child (autoFocus) already
    // took focus during mount.
    const box = boxRef.current;
    if (box && !box.contains(document.activeElement)) {
      box.focus({ preventScroll: true });
    }

    return () => {
      popOverlay(id);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, id]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && isTopOverlay(id)) {
      event.stopPropagation();
      onClose?.(event, "escapeKeyDown");
      return;
    }
    if (event.key !== "Tab" || !boxRef.current) return;
    const items = Array.from(
      boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => el.offsetParent !== null);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  };

  // Close on click (not mousedown) so the browser's own focus change on
  // mousedown happens before focus is restored, and only when the press
  // also started on the backdrop (a drag out of a text field doesn't close).
  const onBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (pressedBackdrop.current && event.target === event.currentTarget) {
      onClose?.(event, "backdropClick");
    }
    pressedBackdrop.current = false;
  };

  return createPortal(
    <DialogTitleIdContext.Provider value={titleId}>
      <div
        className={cn(
          "d-modal d-modal-open z-[1300] bg-grey-900/35 backdrop-blur-[4px] transition-opacity duration-200 dark:bg-grey-900/55 starting:opacity-0",
          fullScreen && "place-items-stretch",
        )}
        onMouseDown={onBackdropMouseDown}
        onClick={onBackdropClick}
        onKeyDown={onKeyDown}
      >
        <div
          ref={boxRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={aria["aria-labelledby"] ?? titleId}
          aria-describedby={aria["aria-describedby"]}
          tabIndex={-1}
          className={cn(
            "d-modal-box flex scale-100 flex-col overflow-y-auto bg-paper p-0 font-sans text-fg outline-none",
            fullScreen
              ? "m-0 h-full max-h-none w-full max-w-none rounded-none border-0"
              : cn(
                  "m-8 max-h-[calc(100%-64px)] rounded-[12px] border border-divider shadow-[0_24px_64px_rgba(0,0,0,0.14)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.55)]",
                  maxWidth ? MAX_WIDTH[maxWidth] : "max-w-[calc(100%-64px)]",
                  fullWidth ? "w-[calc(100%-64px)]" : "w-auto",
                ),
            className,
          )}
        >
          {children}
        </div>
      </div>
    </DialogTitleIdContext.Provider>,
    document.body,
  );
}

export function DialogTitle({
  className,
  id,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  const contextId = useContext(DialogTitleIdContext);
  return (
    <h2
      id={id ?? contextId}
      data-dialog-title=""
      className={cn("m-0 shrink-0 px-6 py-4 text-h6", className)}
      {...rest}
    >
      {children}
    </h2>
  );
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Divider lines above and below the scrolling content. */
  dividers?: boolean;
}

export function DialogContent({
  className,
  dividers = false,
  ...rest
}: DialogContentProps) {
  return (
    <div
      className={cn(
        "flex-auto overflow-y-auto px-6",
        dividers
          ? "border-y border-divider py-4"
          : "py-5 [[data-dialog-title]+&]:pt-0",
        className,
      )}
      {...rest}
    />
  );
}

export function DialogContentText({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("m-0 text-body1 text-fg-muted", className)} {...rest} />
  );
}

export function DialogActions({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 p-2",
        className,
      )}
      {...rest}
    />
  );
}
