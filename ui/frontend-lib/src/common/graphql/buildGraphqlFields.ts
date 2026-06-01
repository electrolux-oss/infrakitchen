/**
 * Maps a table column field name (snake_case) to its GraphQL selection string.
 * Simple fields map to a single camelCase name.
 * Nested fields map to a selection set with sub-fields.
 */
export type GraphqlFieldMap = Record<string, string>;

const SNAKE_TO_CAMEL_RE = /_([a-z])/g;

function snakeToCamel(s: string): string {
  return s.replace(SNAKE_TO_CAMEL_RE, (_, c) => c.toUpperCase());
}

/**
 * Build a GraphQL field selection string from the list of requested table fields.
 *
 * @param requestedFields - snake_case field names from EntityFetchTable (visible columns)
 * @param fieldMap - optional overrides: maps a snake_case field to a custom GraphQL selection
 *                   (e.g. `{ secondary_accounts: "secondaryAccounts { id identifier provider }" }`)
 *                   Fields not in the map are auto-converted from snake_case to camelCase.
 * @returns a string suitable for interpolation inside a GraphQL query `{ ... }`
 */
export function buildGraphqlFields(
  requestedFields: string[],
  fieldMap?: GraphqlFieldMap,
): string {
  const selections = new Set<string>();

  for (const field of requestedFields) {
    if (fieldMap && field in fieldMap) {
      selections.add(fieldMap[field]);
    } else {
      selections.add(snakeToCamel(field));
    }
  }

  return Array.from(selections).join("\n      ");
}

/** Utility function to build a selection string from a list of fields. */
export function buildSelection(fields: readonly string[]): string {
  return fields.join("\n  ");
}

/** Utility function to build a nested selection string for a relation field. */
export function buildNestedSelection(
  field: string,
  nestedFields: string,
): string {
  return `${field} {\n    ${nestedFields}\n  }`;
}
