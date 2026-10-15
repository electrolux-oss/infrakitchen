import {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
  SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import { cn } from "../utils/cn";

import { isTopOverlay, popOverlay, pushOverlay } from "./overlayStack";

export interface PopoverOrigin {
  vertical: "top" | "center" | "bottom";
  horizontal: "left" | "center" | "right";
}

export type PopoverCloseReason =
  "backdropClick" | "escapeKeyDown" | "tabKeyDown";

export interface PopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null | undefined;
  onClose?: (event: SyntheticEvent, reason: PopoverCloseReason) => void;
  /** Point on the anchor the popover attaches to (default: top left). */
  anchorOrigin?: PopoverOrigin;
  /** Point on the popover placed at the anchor point. */
  transformOrigin?: PopoverOrigin;
  /** Classes for the floating surface. */
  className?: string;
  style?: CSSProperties;
  /** Make the surface at least as wide as the anchor (Select menus). */
  matchAnchorWidth?: boolean;
  /** Element to focus on open; defaults to the surface itself. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  id?: string;
  role?: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}

// Keep the popover this far from the viewport edges.
const MARGIN = 16;

const offset = (size: number, origin: string) =>
  origin === "center"
    ? size / 2
    : origin === "bottom" || origin === "right"
      ? size
      : 0;

/**
 * Anchored floating surface: rendered into
 * document.body above an invisible backdrop, closed by outside click or
 * Escape (reporting which), scroll-locking the page while open and
 * returning focus to the anchor on close.
 */
export function Popover({
  open,
  anchorEl,
  onClose,
  anchorOrigin = { vertical: "top", horizontal: "left" },
  transformOrigin = { vertical: "top", horizontal: "left" },
  className,
  style,
  matchAnchorWidth = false,
  initialFocusRef,
  id,
  role,
  onClick,
  onKeyDown,
  children,
}: PopoverProps) {
  const overlayId = useId();
  const paperRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    minWidth?: number;
  } | null>(null);

  const place = useCallback(() => {
    const paper = paperRef.current;
    if (!anchorEl || !paper) return;
    const anchor = anchorEl.getBoundingClientRect();
    const width = paper.offsetWidth;
    const height = paper.offsetHeight;
    let top =
      anchor.top +
      offset(anchor.height, anchorOrigin.vertical) -
      offset(height, transformOrigin.vertical);
    let left =
      anchor.left +
      offset(anchor.width, anchorOrigin.horizontal) -
      offset(width, transformOrigin.horizontal);
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - MARGIN - height));
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - MARGIN - width));
    setPosition({
      top,
      left,
      minWidth: matchAnchorWidth ? anchor.width : undefined,
    });
  }, [anchorEl, anchorOrigin, transformOrigin, matchAnchorWidth]);

  const isOpen = open && Boolean(anchorEl);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    place();
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    if (paperRef.current) observer.observe(paperRef.current);
    return () => {
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
    // Re-place only when opening or the anchor changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, anchorEl]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    pushOverlay(overlayId);
    const target = initialFocusRef?.current ?? paperRef.current;
    target?.focus({ preventScroll: true });
    return () => {
      popOverlay(overlayId);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen, overlayId, initialFocusRef]);

  if (!isOpen) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && isTopOverlay(overlayId)) {
      event.stopPropagation();
      onClose?.(event, "escapeKeyDown");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1300]" onKeyDown={handleKeyDown}>
      <div
        aria-hidden
        className="fixed inset-0"
        onClick={(event) => onClose?.(event, "backdropClick")}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose?.(event, "backdropClick");
        }}
      />
      <div
        ref={paperRef}
        id={id}
        role={role}
        tabIndex={-1}
        onClick={onClick}
        className={cn(
          "fixed max-h-[calc(100%-32px)] max-w-[calc(100%-32px)] overflow-auto rounded-surface bg-paper font-sans text-body2 text-fg shadow-dropdown outline-none",
          "transition-opacity duration-150 starting:opacity-0",
          // opacity, not visibility: hidden elements cannot take focus, and
          // focus moves in before the first position is measured.
          !position && "opacity-0",
          className,
        )}
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          minWidth: position?.minWidth,
          ...style,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
