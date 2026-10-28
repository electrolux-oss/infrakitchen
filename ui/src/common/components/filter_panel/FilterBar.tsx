import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";

import { HeroAdjustmentsHorizontalIcon } from "../../../icons";
import { Button } from "../../../ui";
import { cn } from "../../../utils/cn";

import { isClauseComplete } from "./clauseUtils";
import { FieldPicker } from "./FieldPicker";
import { FilterChip } from "./FilterChip";
import { FilterClauseEditor } from "./FilterClauseEditor";
import { FilterClause, FilterConfig, FilterableField } from "./FilterConfig";
import { useFilterClauses } from "./useFilterClauses";

interface FilterBarProps {
  config: FilterConfig;
  value: FilterClause[];
  onChange: (clauses: FilterClause[]) => void;
  /** Extra controls on the right (e.g. saved view actions). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Compact filter bar: a "Filter" button that adds a filter from a field
 * list, one chip per filter (click to edit in a popover, × to remove) and
 * "Clear all". All filters are combined with AND.
 */
export const FilterBar = ({
  config,
  value,
  onChange,
  trailing,
  className,
}: FilterBarProps) => {
  const { fields } = config;
  const { clauses, update, remove, add, finalize, clear } = useFilterClauses(
    value,
    onChange,
    fields,
  );

  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // A filter just added from the field list starts at the operator step.
  const [newClauseId, setNewClauseId] = useState<string | null>(null);
  const [editorAnchor, setEditorAnchor] = useState<HTMLElement | null>(null);
  const chipRefs = useRef(new Map<string, HTMLElement>());

  const fieldsById = useMemo(
    () => new Map(fields.map((f) => [f.field, f])),
    [fields],
  );
  const usedFields = useMemo(
    () => new Set(clauses.map((c) => c.field)),
    [clauses],
  );
  const appliedCount = clauses.filter(isClauseComplete).length;

  const editingClause = clauses.find((c) => c.id === editingId);
  const editingField = editingClause
    ? fieldsById.get(editingClause.field)
    : undefined;

  // A chip added from the picker only exists after this render commits, so
  // pick up the anchor element afterwards.
  useLayoutEffect(() => {
    setEditorAnchor(
      editingId ? (chipRefs.current.get(editingId) ?? null) : null,
    );
  }, [editingId, clauses]);

  const handlePick = (field: FilterableField) => {
    setPickerAnchor(null);
    const existing = clauses.find((c) => c.field === field.field);
    if (existing) {
      setNewClauseId(null);
      setEditingId(existing.id);
      return;
    }
    const id = add(field);
    setNewClauseId(id);
    setEditingId(id);
  };

  const closeEditor = (pending?: Partial<FilterClause>) => {
    if (editingId) finalize(editingId, pending);
    setEditingId(null);
    setNewClauseId(null);
  };

  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2", className)}>
      <Button
        variant="outlined"
        startIcon={<HeroAdjustmentsHorizontalIcon />}
        onClick={(e) => setPickerAnchor(e.currentTarget)}
        aria-haspopup="listbox"
        aria-expanded={Boolean(pickerAnchor)}
      >
        Filter
        {appliedCount > 0 && (
          <span className="ml-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] leading-none font-semibold text-white">
            {appliedCount}
          </span>
        )}
      </Button>

      {clauses.map((clause) => (
        <FilterChip
          key={clause.id}
          ref={(el) => {
            if (el) chipRefs.current.set(clause.id, el);
            else chipRefs.current.delete(clause.id);
          }}
          clause={clause}
          field={fieldsById.get(clause.field)}
          active={clause.id === editingId}
          onEdit={() => {
            setNewClauseId(null);
            setEditingId(clause.id);
          }}
          onRemove={() => remove(clause.id)}
        />
      ))}

      {clauses.length > 0 && (
        <Button variant="text" color="inherit" onClick={clear}>
          Clear all
        </Button>
      )}

      {trailing && (
        <div className="ml-auto flex items-center gap-1">{trailing}</div>
      )}

      <FieldPicker
        anchorEl={pickerAnchor}
        fields={fields}
        usedFields={usedFields}
        onPick={handlePick}
        onClose={() => setPickerAnchor(null)}
      />

      {editingClause && editingField && (
        <FilterClauseEditor
          key={editingClause.id}
          anchorEl={editorAnchor}
          clause={editingClause}
          clauses={clauses}
          field={editingField}
          chooseOperatorFirst={
            editingClause.id === newClauseId &&
            editingField.operators.length > 1
          }
          onUpdate={(updates) => update(editingClause.id, updates)}
          onClose={closeEditor}
          onRemove={() => {
            remove(editingClause.id);
            setEditingId(null);
            setNewClauseId(null);
          }}
        />
      )}
    </div>
  );
};
