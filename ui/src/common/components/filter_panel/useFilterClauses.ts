import { useCallback, useEffect, useRef, useState } from "react";

import { notify } from "../../hooks/useNotification";

import {
  coerceValueForOperator,
  emptyValueFor,
  getDefaultOperator,
  isClauseComplete,
  makeClause,
} from "./clauseUtils";
import { FilterClause, FilterableField } from "./FilterConfig";

const serialize = (clauses: FilterClause[]) => JSON.stringify(clauses);

const findField = (fields: FilterableField[], field: string) =>
  fields.find((f) => f.field === field);

/** Resets clauses whose operator the field no longer offers (stale URLs). */
function normalizeClauses(
  clauses: FilterClause[],
  fields: FilterableField[],
): FilterClause[] {
  return clauses.map((clause) => {
    const spec = findField(fields, clause.field);
    if (!spec || spec.operators.includes(clause.operator)) return clause;
    const operator = getDefaultOperator(spec);
    return {
      ...clause,
      operator,
      value: coerceValueForOperator(clause.value, clause.operator, operator),
    };
  });
}

/**
 * Clears the value of every clause that depends on one of `changedFields`
 * (e.g. Template Version when Template changes). Returns the clauses that
 * lost a value so the user can be told.
 */
function clearDependents(
  clauses: FilterClause[],
  fields: FilterableField[],
  changedFields: Set<string>,
): { next: FilterClause[]; cleared: FilterClause[] } {
  const cleared: FilterClause[] = [];
  if (changedFields.size === 0) return { next: clauses, cleared };

  const next = clauses.map((clause) => {
    const spec = findField(fields, clause.field);
    const dependsOnChanged =
      spec?.dependencies?.some((dep) => changedFields.has(dep)) ?? false;
    if (!dependsOnChanged) return clause;
    if (isClauseComplete(clause)) cleared.push(clause);
    return { ...clause, value: emptyValueFor(clause.operator) };
  });
  return { next, cleared };
}

function applyUpdate(
  clauses: FilterClause[],
  fields: FilterableField[],
  id: string,
  updates: Partial<FilterClause>,
) {
  const prev = clauses.find((c) => c.id === id);
  if (!prev) return { next: clauses, cleared: [] as FilterClause[] };

  const updated = { ...prev, ...updates };
  // Only a different selection rescopes dependents; switching "is" to
  // "is any of" with the same pick does not.
  const asList = (v: any) => JSON.stringify(Array.isArray(v) ? v : [v]);
  const changedFields = new Set<string>();
  if (updated.field !== prev.field) {
    if (prev.field) changedFields.add(prev.field);
    if (updated.field) changedFields.add(updated.field);
  } else if (asList(updated.value) !== asList(prev.value) && updated.field) {
    changedFields.add(updated.field);
  }

  const replaced = clauses.map((c) => (c.id === id ? updated : c));
  return clearDependents(replaced, fields, changedFields);
}

function applyRemove(
  clauses: FilterClause[],
  fields: FilterableField[],
  id: string,
) {
  const removed = clauses.find((c) => c.id === id);
  const remaining = clauses.filter((c) => c.id !== id);
  // An empty clause never scoped anything, so its dependents stay as they are.
  if (!removed || !isClauseComplete(removed)) {
    return { next: remaining, cleared: [] as FilterClause[] };
  }
  return clearDependents(remaining, fields, new Set([removed.field]));
}

/**
 * Local clause state for the filter bar. Holds unfinished (draft) clauses
 * that are not applied yet, and emits only complete clauses to `onChange`.
 * A `value` that differs from what was last emitted (URL load, reset,
 * restoring a saved view) replaces the local state.
 */
export function useFilterClauses(
  value: FilterClause[],
  onChange: (clauses: FilterClause[]) => void,
  fields: FilterableField[],
) {
  const [clauses, setClauses] = useState<FilterClause[]>(() =>
    normalizeClauses(value, fields),
  );
  const lastEmittedRef = useRef(serialize(value));
  // Latest clauses for callbacks fired later (debounced text, popovers).
  const clausesRef = useRef(clauses);
  clausesRef.current = clauses;

  useEffect(() => {
    const incoming = serialize(value);
    if (incoming === lastEmittedRef.current) return;
    lastEmittedRef.current = incoming;
    const next = normalizeClauses(value, fields);
    clausesRef.current = next;
    setClauses(next);
  }, [value, fields]);

  const commit = useCallback(
    (next: FilterClause[], cleared: FilterClause[] = []) => {
      const applied = next.filter(isClauseComplete);
      const serialized = serialize(applied);
      clausesRef.current = next;
      setClauses(next);
      if (serialized !== lastEmittedRef.current) {
        lastEmittedRef.current = serialized;
        onChange(applied);
      }
      cleared.forEach((clause) => {
        const label = findField(fields, clause.field)?.label ?? clause.field;
        notify(
          `${label} filter cleared: it depends on a filter you changed`,
          "info",
        );
      });
    },
    [fields, onChange],
  );

  const update = useCallback(
    (id: string, updates: Partial<FilterClause>) => {
      const { next, cleared } = applyUpdate(
        clausesRef.current,
        fields,
        id,
        updates,
      );
      commit(next, cleared);
    },
    [commit, fields],
  );

  const remove = useCallback(
    (id: string) => {
      const { next, cleared } = applyRemove(clausesRef.current, fields, id);
      commit(next, cleared);
    },
    [commit, fields],
  );

  /** Adds a clause for `field` and returns its id. */
  const add = useCallback(
    (field: FilterableField): string => {
      const clause = makeClause(field);
      commit([...clausesRef.current, clause]);
      return clause.id;
    },
    [commit],
  );

  /**
   * Called when a clause editor closes: applies any pending edit, then drops
   * the clause if it is still empty.
   */
  const finalize = useCallback(
    (id: string, pending?: Partial<FilterClause>) => {
      const current = clausesRef.current;
      let next = current;
      let cleared: FilterClause[] = [];
      if (pending) {
        ({ next, cleared } = applyUpdate(next, fields, id, pending));
      }
      const clause = next.find((c) => c.id === id);
      if (clause && !isClauseComplete(clause)) {
        next = applyRemove(next, fields, id).next;
      }
      if (next !== current) commit(next, cleared);
    },
    [commit, fields],
  );

  const clear = useCallback(() => commit([]), [commit]);

  return { clauses, update, remove, add, finalize, clear };
}
