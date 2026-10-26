/** How many resources are updated at the same time by the batch dialogs. */
export const UPDATE_CONCURRENCY = 4;

export const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Run `fn` for every target, at most UPDATE_CONCURRENCY at a time.
 * Returns the targets whose call threw.
 */
export const runInBatches = async <T>(
  targets: T[],
  fn: (target: T) => Promise<unknown>,
): Promise<T[]> => {
  const failed: T[] = [];
  for (let i = 0; i < targets.length; i += UPDATE_CONCURRENCY) {
    await Promise.all(
      targets.slice(i, i + UPDATE_CONCURRENCY).map(async (target) => {
        try {
          await fn(target);
        } catch {
          failed.push(target);
        }
      }),
    );
  }
  return failed;
};

export interface SchemaQueryTarget {
  sourceCodeVersionId: string;
  parentIds: string[];
  projectId: string | null;
}

/**
 * One aliased query fetching the variable schema of every target:
 * `s0: resourceVariableSchema(...)`, `s1: ...`. Results are keyed `s<index>`.
 */
export const buildSchemaQuery = (
  name: string,
  targets: SchemaQueryTarget[],
  selection: string,
): { query: string; variables: Record<string, unknown> } => {
  const defs = targets
    .map((_, i) => `$scv${i}: UUID!, $parents${i}: [UUID!], $project${i}: UUID`)
    .join(", ");
  const fields = targets
    .map(
      (_, i) => `s${i}: resourceVariableSchema(
        sourceCodeVersionId: $scv${i}
        parentResourceIds: $parents${i}
        projectId: $project${i}
      ) { ${selection} }`,
    )
    .join("\n");
  const variables: Record<string, unknown> = {};
  targets.forEach((target, i) => {
    variables[`scv${i}`] = target.sourceCodeVersionId;
    variables[`parents${i}`] = target.parentIds;
    variables[`project${i}`] = target.projectId;
  });
  return { query: `query ${name}(${defs}) {\n${fields}\n}`, variables };
};
