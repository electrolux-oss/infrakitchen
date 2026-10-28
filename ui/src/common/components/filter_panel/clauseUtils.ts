import { FilterClause, FilterOperator, FilterableField } from "./FilterConfig";

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "is",
  not_eq: "is not",
  like: "contains",
  not_like: "does not contain",
  is_none: "is empty",
  in: "is any of",
  contains_all: "includes all of",
  contains_entries: "has key = value",
  any: "includes any of",
};

// Stored as the value of valueless operators (is_none) so the clause counts
// as filled.
export const VALUELESS_OPERATOR_SENTINEL = true;

let clauseIdCounter = 0;
export function generateClauseId(): string {
  return `clause_${Date.now()}_${++clauseIdCounter}`;
}

export function isMultiValueOperator(op: FilterOperator): boolean {
  return (
    op === "in" ||
    op === "contains_all" ||
    op === "contains_entries" ||
    op === "any"
  );
}

export function isValuelessOperator(op: FilterOperator): boolean {
  return op === "is_none";
}

export function getDefaultOperator(field?: FilterableField): FilterOperator {
  return field?.defaultOperator || field?.operators[0] || "eq";
}

export function emptyValueFor(op: FilterOperator): any {
  if (isValuelessOperator(op)) return VALUELESS_OPERATOR_SENTINEL;
  return isMultiValueOperator(op) ? [] : "";
}

/** Converts a clause value when its operator changes (single <-> multi). */
export function coerceValueForOperator(
  value: any,
  fromOp: FilterOperator,
  toOp: FilterOperator,
): any {
  if (isValuelessOperator(toOp) || isValuelessOperator(fromOp)) {
    return emptyValueFor(toOp);
  }
  const wasMulti = isMultiValueOperator(fromOp);
  const isMulti = isMultiValueOperator(toOp);
  if (wasMulti && !isMulti) {
    return Array.isArray(value) ? value[0] || "" : "";
  }
  if (!wasMulti && isMulti) {
    return value ? [value] : [];
  }
  return value;
}

export function makeClause(field: FilterableField): FilterClause {
  const operator = getDefaultOperator(field);
  return {
    id: generateClauseId(),
    field: field.field,
    operator,
    value: emptyValueFor(operator),
  };
}

/** A clause is applied only once it has a field and (if needed) a value. */
export function isClauseComplete(clause: FilterClause): boolean {
  if (!clause.field) return false;
  if (isValuelessOperator(clause.operator)) return true;
  const { value } = clause;
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
