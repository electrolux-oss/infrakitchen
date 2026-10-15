import {
  createContext,
  HTMLAttributes,
  ReactNode,
  SyntheticEvent,
  useContext,
  useId,
  useState,
} from "react";

import { cn } from "../utils/cn";

interface AccordionState {
  expanded: boolean;
  toggle: (event: SyntheticEvent) => void;
  disabled: boolean;
  id: string;
}

const AccordionContext = createContext<AccordionState | null>(null);

export interface AccordionProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  expanded?: boolean;
  defaultExpanded?: boolean;
  onChange?: (event: SyntheticEvent, expanded: boolean) => void;
  disabled?: boolean;
  /** Drop the corner radius. */
  square?: boolean;
  /** A separate accordion: fully bordered and rounded instead of joining
   * its sibling accordions into one block. */
  standalone?: boolean;
}

/**
 * Expandable section on daisyUI's `collapse`.
 * Controlled (expanded + onChange) or uncontrolled (defaultExpanded).
 * Adjacent accordions share borders and round only the outer corners.
 */
export function Accordion({
  expanded,
  defaultExpanded = false,
  onChange,
  disabled = false,
  square = false,
  standalone = false,
  className,
  children,
  ...rest
}: AccordionProps) {
  const [internal, setInternal] = useState(defaultExpanded);
  const isExpanded = expanded ?? internal;
  const id = useId();
  const toggle = (event: SyntheticEvent) => {
    if (disabled) return;
    if (expanded === undefined) setInternal(!isExpanded);
    onChange?.(event, !isExpanded);
  };

  return (
    <AccordionContext.Provider
      value={{ expanded: isExpanded, toggle, disabled, id }}
    >
      <div
        className={cn(
          "d-collapse overflow-clip rounded-none border border-divider bg-paper p-1",
          standalone
            ? !square && "rounded-surface"
            : cn(
                "[&:not(:last-of-type)]:border-b-0",
                !square &&
                  "first-of-type:rounded-t-surface last-of-type:rounded-b-surface",
              ),
          isExpanded ? "d-collapse-open" : "d-collapse-close",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionSummaryProps extends HTMLAttributes<HTMLDivElement> {
  expandIcon?: ReactNode;
  /** Put the expand icon before the content. */
  iconFirst?: boolean;
  /** Classes for the rotating icon wrapper. */
  iconClassName?: string;
  /** Classes for the content wrapper (default vertical margin 12px). */
  contentClassName?: string;
}

export function AccordionSummary({
  expandIcon,
  iconFirst = false,
  iconClassName,
  contentClassName,
  className,
  children,
  ...rest
}: AccordionSummaryProps) {
  const state = useContext(AccordionContext);
  const expanded = state?.expanded ?? false;
  return (
    <div
      role="button"
      tabIndex={state?.disabled ? -1 : 0}
      aria-expanded={expanded}
      aria-controls={state ? `${state.id}-details` : undefined}
      aria-disabled={state?.disabled || undefined}
      onClick={(event) => state?.toggle(event)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          state?.toggle(event);
        }
      }}
      className={cn(
        "d-collapse-title flex min-h-12 cursor-pointer items-center gap-0 rounded-surface border-0 px-4 py-0 text-body2 outline-none after:hidden focus-visible:bg-transparent",
        iconFirst && "flex-row-reverse",
        className,
      )}
      {...rest}
    >
      <div className={cn("my-3 flex min-w-0 flex-1", contentClassName)}>
        {children}
      </div>
      {expandIcon && (
        <span
          className={cn(
            "flex shrink-0 text-action-active transition-transform duration-150",
            expanded && (iconFirst ? "rotate-90" : "rotate-180"),
            iconClassName,
          )}
        >
          {expandIcon}
        </span>
      )}
    </div>
  );
}

export function AccordionDetails({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const state = useContext(AccordionContext);
  return (
    <div
      id={state ? `${state.id}-details` : undefined}
      role="region"
      className={cn(
        "d-collapse-content min-h-0 px-4",
        state?.expanded ? "pt-2 pb-4" : "py-0",
        className,
      )}
      {...rest}
    />
  );
}
