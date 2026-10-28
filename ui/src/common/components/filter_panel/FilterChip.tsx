import { forwardRef, useEffect, useMemo, useState } from "react";

import { HeroXMarkIcon } from "../../../icons";
import { Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";

import {
  OPERATOR_LABELS,
  isClauseComplete,
  isValuelessOperator,
} from "./clauseUtils";
import { FilterClause, FilterableField } from "./FilterConfig";

const MAX_SHOWN_VALUES = 2;

// Reference ids are UUIDs, so one cache serves every entity type.
const referenceLabelCache = new Map<string, string>();

/** Display names for a clause's values (reference ids resolved to names). */
function useValueLabels(clause: FilterClause, field?: FilterableField) {
  const values = useMemo<string[]>(() => {
    if (isValuelessOperator(clause.operator)) return [];
    const raw = Array.isArray(clause.value) ? clause.value : [clause.value];
    return raw
      .filter((v) => v !== undefined && v !== null && v !== "")
      .map(String);
  }, [clause.operator, clause.value]);

  const resolve = field?.loadReferenceOptions?.resolveByIds;
  const [, setResolvedVersion] = useState(0);

  useEffect(() => {
    if (!resolve) return;
    const missing = values.filter((v) => !referenceLabelCache.has(v));
    if (missing.length === 0) return;
    let active = true;
    resolve(missing)
      .then((options) => {
        options.forEach((o) => referenceLabelCache.set(o.value, o.label));
        if (active) setResolvedVersion((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resolve, values]);

  return values.map((value) => {
    const option = field?.selectOptions?.find((o) => o.value === value);
    if (option) return option.label;
    if (resolve) return referenceLabelCache.get(value) ?? "…";
    return value;
  });
}

function summarize(labels: string[], quote: boolean): string {
  const shown = labels
    .slice(0, MAX_SHOWN_VALUES)
    .map((l) => (quote ? `"${l}"` : l));
  const more = labels.length - shown.length;
  return more > 0 ? `${shown.join(", ")} +${more}` : shown.join(", ");
}

interface FilterChipProps {
  clause: FilterClause;
  field?: FilterableField;
  active: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

/** One filter in the bar: "Field operator value", click to edit, × to remove. */
export const FilterChip = forwardRef<HTMLSpanElement, FilterChipProps>(
  function FilterChip({ clause, field, active, onEdit, onRemove }, ref) {
    const labels = useValueLabels(clause, field);
    const fieldLabel = field?.label ?? clause.field;
    const operatorLabel = OPERATOR_LABELS[clause.operator];
    const complete = isClauseComplete(clause);
    const quote = field?.valueType === "text";
    const summary = summarize(labels, quote);
    const fullText = [fieldLabel, operatorLabel, labels.join(", ")]
      .filter(Boolean)
      .join(" ");

    // Only explain what the chip can't show: a draft, or a shortened summary.
    const truncated = labels.length > MAX_SHOWN_VALUES || summary.length > 32;
    const tooltip = active
      ? null
      : !complete
        ? "Not applied yet: choose a value"
        : truncated
          ? fullText
          : null;

    return (
      <Tooltip title={tooltip}>
        <span
          ref={ref}
          className={cn(
            "inline-flex h-7 max-w-full min-w-0 items-center rounded-full border text-body2 transition-colors",
            complete
              ? "border-divider bg-paper text-fg"
              : "border-dashed border-fg-muted/60 bg-transparent text-fg-muted",
            active && "border-primary ring-2 ring-primary/20",
          )}
        >
          <button
            type="button"
            onClick={onEdit}
            aria-haspopup="dialog"
            aria-expanded={active}
            className="flex h-full min-w-0 cursor-pointer items-center gap-1 rounded-l-full border-0 bg-transparent py-0 pr-1 pl-3 text-inherit focus-visible:outline-2 focus-visible:outline-primary/35"
          >
            <span className="shrink-0 font-semibold">{fieldLabel}</span>
            <span className="shrink-0 text-fg-muted">{operatorLabel}</span>
            {summary && (
              <span className="max-w-60 min-w-0 truncate">{summary}</span>
            )}
          </button>
          <button
            type="button"
            aria-label={`Remove ${fieldLabel} filter`}
            onClick={onRemove}
            className="mr-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-primary/35 [&_svg]:text-sm"
          >
            <HeroXMarkIcon />
          </button>
        </span>
      </Tooltip>
    );
  },
);
