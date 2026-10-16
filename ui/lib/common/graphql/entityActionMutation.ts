const SNAKE_TO_CAMEL_RE = /_([a-z])/g;

function snakeToCamel(s: string): string {
  return s.replace(SNAKE_TO_CAMEL_RE, (_, c: string) => c.toUpperCase());
}

function snakeToPascal(s: string): string {
  const camel = snakeToCamel(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Builds a GraphQL action mutation for any entity type.
 *
 * The backend exposes a consistent `{entityName}Action` mutation for every
 * entity (resource, executor, secret, template, etc.) that accepts an
 * `{EntityName}ActionInput` containing the action string.
 *
 * @param entityName - The snake_case entity name (e.g. "resource", "source_code_version")
 * @returns A GraphQL mutation string ready for `ikApi.graphqlRequest()`
 */
export function buildEntityActionMutation(entityName: string): string {
  const camel = snakeToCamel(entityName);
  const pascal = snakeToPascal(entityName);

  return `
    mutation ${pascal}Action($id: UUID!, $input: ${pascal}ActionInput!) {
      ${camel}Action(id: $id, input: $input) {
        id
        entityName
        status
      }
    }
  `;
}

/**
 * Builds a GraphQL delete mutation for any entity type.
 *
 * The backend exposes a consistent `delete{EntityName}(id: UUID!) -> Boolean!`
 * mutation for every entity.
 *
 * @param entityName - The snake_case entity name (e.g. "resource", "source_code_version")
 * @returns A GraphQL mutation string ready for `ikApi.graphqlRequest()`
 */
export function buildEntityDeleteMutation(entityName: string): string {
  const pascal = snakeToPascal(entityName);

  return `
    mutation Delete${pascal}($id: UUID!) {
      delete${pascal}(id: $id)
    }
  `;
}
