import { FilterClause } from "./FilterConfig";

/**
 * Converts an array of FilterClauses (from the "filter" filter key)
 * into the flat API filter dict the backend expects.
 * Each clause produces a `field__operator` key (or bare `field` for eq).
 * Backend combines all filters with AND.
 *
 * This is a generic utility — works for any entity page using advanced filters.
 */
export const buildAdvancedApiFilters = (
  filterValues: Record<string, any>,
): Record<string, any> => {
  const clauses: FilterClause[] = filterValues.filter;
  if (!clauses || !Array.isArray(clauses)) return {};

  const apiFilters: Record<string, any> = {};

  for (const clause of clauses) {
    if (!clause.field) continue;

    if (clause.operator === "is_none") {
      apiFilters[`${clause.field}__${clause.operator}`] = true;
      continue;
    }

    // Skip empty values
    const val = clause.value;
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;

    // Build the filter key
    const key =
      clause.operator === "eq"
        ? clause.field
        : `${clause.field}__${clause.operator}`;

    apiFilters[key] = val;
  }

  return apiFilters;
};
