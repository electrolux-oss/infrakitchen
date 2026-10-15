import {
  cloneElement,
  FocusEvent,
  isValidElement,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefCallback,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import { cn } from "../utils/cn";

type Side = "top" | "bottom" | "left" | "right";
export type TooltipPlacement = Side | `${"top" | "bottom"}-${"start" | "end"}`;

export interface TooltipProps {
  /** Tooltip content; empty or null renders the child alone. */
  title: ReactNode;
  /** A single element that accepts a ref and mouse/focus handlers. */
  children: ReactElement;
  placement?: TooltipPlacement;
  arrow?: boolean;
  /** Milliseconds before showing on hover. */
  enterDelay?: number;
  /** Show on focus only, not on hover. */
  disableHoverListener?: boolean;
  className?: string;
}

// Distance between the anchor and the tooltip box.
const GAP = 14;
const VIEWPORT_MARGIN = 8;

type ChildProps = {
  ref?: Ref<HTMLElement>;
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function computePosition(
  anchor: DOMRect,
  box: { width: number; height: number },
  placement: TooltipPlacement,
  gap: number,
) {
  const [preferred, align] = placement.split("-") as [
    Side,
    "start" | "end" | undefined,
  ];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits = (p: Side) =>
    p === "top"
      ? anchor.top - gap - box.height >= VIEWPORT_MARGIN
      : p === "bottom"
        ? anchor.bottom + gap + box.height <= vh - VIEWPORT_MARGIN
        : p === "left"
          ? anchor.left - gap - box.width >= VIEWPORT_MARGIN
          : anchor.right + gap + box.width <= vw - VIEWPORT_MARGIN;
  const side =
    fits(preferred) || !fits(OPPOSITE[preferred])
      ? preferred
      : OPPOSITE[preferred];

  let top: number;
  let left: number;
  if (side === "top" || side === "bottom") {
    top = side === "top" ? anchor.top - gap - box.height : anchor.bottom + gap;
    left =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - box.width
          : anchor.left + anchor.width / 2 - box.width / 2;
  } else {
    left = side === "left" ? anchor.left - gap - box.width : anchor.right + gap;
    top = anchor.top + anchor.height / 2 - box.height / 2;
  }
  const clampedLeft = Math.min(
    Math.max(left, VIEWPORT_MARGIN),
    vw - VIEWPORT_MARGIN - box.width,
  );
  const clampedTop = Math.min(
    Math.max(top, VIEWPORT_MARGIN),
    vh - VIEWPORT_MARGIN - box.height,
  );
  // Arrow offset along the box edge, pointing at the anchor's center.
  const arrowOffset =
    side === "top" || side === "bottom"
      ? anchor.left + anchor.width / 2 - clampedLeft
      : anchor.top + anchor.height / 2 - clampedTop;
  return { top: clampedTop, left: clampedLeft, side, arrowOffset };
}

/**
 * Hover/focus tooltip (paper
 * surface, divider border, caption text). It renders into document.body so
 * overflow-hidden parents and grid cells can't clip it, which daisyUI's
 * CSS-only tooltip can't avoid.
 */
export function Tooltip({
  title,
  children,
  placement = "bottom",
  arrow = false,
  enterDelay = 100,
  disableHoverListener = false,
  className,
}: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ReturnType<
    typeof computePosition
  > | null>(null);

  const hasTitle = title !== null && title !== undefined && title !== "";

  const show = useCallback(
    (delay: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(true), delay);
    },
    [setOpen],
  );
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
    setPosition(null);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const box = boxRef.current;
    if (!anchor || !box) return;
    if (!anchor.isConnected) {
      hide();
      return;
    }
    setPosition(
      computePosition(
        anchor.getBoundingClientRect(),
        { width: box.offsetWidth, height: box.offsetHeight },
        placement,
        GAP,
      ),
    );
  }, [placement, hide]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, title]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hide]);

  if (!isValidElement<ChildProps>(children)) return children;

  const childProps = children.props;
  // React 19 passes ref as a regular prop.
  const childRef = childProps.ref;
  const mergedRef: RefCallback<HTMLElement> = (node) => {
    anchorRef.current = node;
    setRef(childRef, node);
  };

  const child = cloneElement(children, {
    ref: mergedRef,
    "aria-label":
      childProps["aria-label"] ??
      (typeof title === "string" && title ? title : undefined),
    "aria-describedby":
      open && typeof title !== "string" ? id : childProps["aria-describedby"],
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      childProps.onMouseEnter?.(event);
      if (hasTitle && !disableHoverListener) show(enterDelay);
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      childProps.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(event);
      if (hasTitle && event.target.matches(":focus-visible")) show(0);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(event);
      hide();
    },
  });

  return (
    <>
      {child}
      {open &&
        hasTitle &&
        createPortal(
          <div
            ref={boxRef}
            id={id}
            role="tooltip"
            className={cn(
              "pointer-events-none fixed z-[1500] max-w-[300px] rounded-surface border border-divider bg-paper px-2.5 py-1.5 font-sans text-caption leading-[1.4] font-medium wrap-break-word text-fg shadow-dropdown",
              position ? "visible" : "invisible",
              className,
            )}
            style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
          >
            {title}
            {arrow && position && (
              <span
                aria-hidden
                className={cn(
                  "absolute size-2.5 rotate-45 border-divider bg-paper",
                  position.side === "top" &&
                    "-bottom-[5.5px] border-r border-b",
                  position.side === "bottom" &&
                    "-top-[5.5px] border-t border-l",
                  position.side === "left" &&
                    "-right-[5.5px] border-t border-r",
                  position.side === "right" &&
                    "-left-[5.5px] border-b border-l",
                )}
                style={
                  position.side === "top" || position.side === "bottom"
                    ? { left: position.arrowOffset - 5 }
                    : { top: position.arrowOffset - 5 }
                }
              />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
