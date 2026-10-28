import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { Button, MenuItem, Popover, Select } from "../../../ui";
import { cn } from "../../../utils/cn";

import {
  OPERATOR_LABELS,
  coerceValueForOperator,
  isValuelessOperator,
} from "./clauseUtils";
import { FilterClause, FilterOperator, FilterableField } from "./FilterConfig";
import { FilterValueInput } from "./FilterValueInput";

const TEXT_DEBOUNCE_MS = 350;

const BOTTOM_LEFT = { vertical: "bottom", horizontal: "left" } as const;
const TOP_LEFT = { vertical: "top", horizontal: "left" } as const;

interface FilterClauseEditorProps {
  anchorEl: HTMLElement | null;
  clause: FilterClause;
  clauses: FilterClause[];
  field: FilterableField;
  /** Start by picking the operator from a list (new filters). */
  chooseOperatorFirst?: boolean;
  onUpdate: (updates: Partial<FilterClause>) => void;
  /** Closes the editor, handing over a typed value not applied yet. */
  onClose: (pending?: Partial<FilterClause>) => void;
  onRemove: () => void;
}

/**
 * Popover for editing one filter: operator and value, applied live (typed
 * text after a short pause). Mount it only while a clause is being edited.
 */
export const FilterClauseEditor = ({
  anchorEl,
  clause,
  clauses,
  field,
  chooseOperatorFirst = false,
  onUpdate,
  onClose,
  onRemove,
}: FilterClauseEditorProps) => {
  const [step, setStep] = useState<"operator" | "value">(
    chooseOperatorFirst ? "operator" : "value",
  );
  const [activeOp, setActiveOp] = useState(() =>
    Math.max(0, field.operators.indexOf(clause.operator)),
  );
  const operatorListRef = useRef<HTMLUListElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => cancelTimer, []);

  // The popover focuses its surface first; then move focus to the value.
  useEffect(() => {
    if (!anchorEl) return;
    const id = setTimeout(() => {
      if (step === "operator") {
        operatorListRef.current?.focus();
        return;
      }
      valueRef.current
        ?.querySelector<HTMLElement>("input:not([disabled])")
        ?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [anchorEl, clause.operator, step]);

  const handleTextChange = (text: string) => {
    pendingRef.current = text;
    cancelTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending !== null) onUpdate({ value: pending });
    }, TEXT_DEBOUNCE_MS);
  };

  const close = () => {
    cancelTimer();
    const pending = pendingRef.current;
    pendingRef.current = null;
    onClose(pending !== null ? { value: pending } : undefined);
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    cancelTimer();
    const current = pendingRef.current ?? clause.value;
    pendingRef.current = null;
    onUpdate({
      operator,
      value: coerceValueForOperator(current, clause.operator, operator),
    });
  };

  const pickOperator = (operator: FilterOperator) => {
    if (operator !== clause.operator) handleOperatorChange(operator);
    // "is empty" needs no value, so the filter is done.
    if (isValuelessOperator(operator)) {
      onClose();
      return;
    }
    setStep("value");
  };

  const handleOperatorKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const count = field.operators.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOp((i) => (i + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOp((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pickOperator(field.operators[activeOp]);
    }
  };

  const operatorStep = (
    <div className="flex flex-col gap-1">
      <span className="truncate px-1 font-semibold">{field.label}</span>
      <ul
        ref={operatorListRef}
        role="listbox"
        tabIndex={0}
        aria-label={`${field.label} operator`}
        aria-activedescendant={`filter-op-${field.operators[activeOp]}`}
        onKeyDown={handleOperatorKeyDown}
        className="m-0 list-none p-0 outline-none"
      >
        {field.operators.map((op, index) => (
          <li
            key={op}
            id={`filter-op-${op}`}
            role="option"
            aria-selected={index === activeOp}
            onMouseEnter={() => setActiveOp(index)}
            onClick={() => pickOperator(op)}
            className={cn(
              "cursor-pointer rounded-surface px-2 py-1.5",
              index === activeOp && "bg-hover",
            )}
          >
            {OPERATOR_LABELS[op]}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      anchorOrigin={BOTTOM_LEFT}
      transformOrigin={TOP_LEFT}
      onClose={close}
      className="mt-1 w-88 border border-divider p-3"
      role="dialog"
    >
      {step === "operator" ? (
        operatorStep
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{field.label}</span>
            {field.operators.length > 1 ? (
              <Select
                size="small"
                variant="standard"
                className="text-fg-muted"
                value={clause.operator}
                onChange={(e) =>
                  handleOperatorChange(e.target.value as FilterOperator)
                }
              >
                {field.operators.map((op) => (
                  <MenuItem key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <span className="text-fg-muted">
                {OPERATOR_LABELS[clause.operator]}
              </span>
            )}
          </div>
          <div ref={valueRef} className="empty:hidden">
            <FilterValueInput
              clause={clause}
              clauses={clauses}
              field={field}
              onChange={(value) => onUpdate({ value })}
              onTextChange={handleTextChange}
              onSubmit={close}
            />
          </div>
          <div className="flex items-center justify-between">
            <Button variant="text" color="error" onClick={onRemove}>
              Remove filter
            </Button>
            <Button variant="contained" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
};
