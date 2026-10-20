import { GenericStep, GenericTemplate, WiringRule } from "./types";

const COL_WIDTH = 360;
const ROW_HEIGHT = 280;

/**
 * Groups templates into columns by dependency: a template that consumes
 * another template's output is placed one column after its deepest
 * dependency (longest path). Within a column templates are ordered by the
 * average row of their dependencies to reduce edge crossings. Wiring cycles
 * are ignored.
 */
function computeDependencyColumns(
  templates: GenericTemplate[],
  wiring: WiringRule[],
): GenericTemplate[][] {
  const index = new Map(templates.map((t, i) => [t.id, i]));
  const dependencies = new Map<string, Set<string>>(
    templates.map((t) => [t.id, new Set()]),
  );
  for (const w of wiring) {
    if (
      w.source_template_id !== w.target_template_id &&
      index.has(w.source_template_id) &&
      index.has(w.target_template_id)
    ) {
      dependencies.get(w.target_template_id)!.add(w.source_template_id);
    }
  }

  const column = new Map<string, number>();
  const visiting = new Set<string>();
  const columnOf = (id: string): number => {
    const known = column.get(id);
    if (known !== undefined) return known;
    visiting.add(id);
    let col = 0;
    for (const dep of dependencies.get(id)!) {
      if (!visiting.has(dep)) col = Math.max(col, columnOf(dep) + 1);
    }
    visiting.delete(id);
    column.set(id, col);
    return col;
  };

  const columns: GenericTemplate[][] = [];
  for (const t of templates) {
    const col = columnOf(t.id);
    (columns[col] ??= []).push(t);
  }

  const row = new Map<string, number>();
  for (const group of columns) {
    if (!group) continue;
    const weight = (t: GenericTemplate) => {
      const rows = [...dependencies.get(t.id)!]
        .map((dep) => row.get(dep))
        .filter((r): r is number => r !== undefined);
      return rows.length
        ? rows.reduce((a, b) => a + b, 0) / rows.length
        : index.get(t.id)!;
    };
    group.sort(
      (a, b) => weight(a) - weight(b) || index.get(a.id)! - index.get(b.id)!,
    );
    group.forEach((t, i) => row.set(t.id, i));
  }

  return columns.filter(Boolean);
}

/**
 * Grid positions for a wiring graph: external templates and constants in the
 * first column, templates in dependency columns (or by workflow step
 * position when steps are given).
 */
export function computeDiagramLayout(
  templates: GenericTemplate[],
  externalTemplates: Array<{ id: string; name: string }>,
  constants: Array<{ id: string; name: string }>,
  wiring: WiringRule[],
  stepByTemplate?: Map<string, GenericStep>,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const hasLeft = externalTemplates.length > 0 || constants.length > 0;
  const xOffset = hasLeft ? COL_WIDTH : 0;

  for (let i = 0; i < externalTemplates.length; i++) {
    positions[`ext-${externalTemplates[i].id}`] = {
      x: 0,
      y: 40 + i * ROW_HEIGHT,
    };
  }

  for (let i = 0; i < constants.length; i++) {
    positions[`const-${constants[i].id}`] = {
      x: 0,
      y: 40 + (externalTemplates.length + i) * ROW_HEIGHT,
    };
  }

  if (stepByTemplate && stepByTemplate.size > 0) {
    const byPosition = new Map<number, GenericTemplate[]>();
    for (const t of templates) {
      const step = stepByTemplate.get(t.id);
      const pos = step?.position ?? 0;
      if (!byPosition.has(pos)) byPosition.set(pos, []);
      byPosition.get(pos)!.push(t);
    }

    const sortedCols = [...byPosition.keys()].sort((a, b) => a - b);
    for (let col = 0; col < sortedCols.length; col++) {
      const group = byPosition.get(sortedCols[col])!;
      for (let row = 0; row < group.length; row++) {
        positions[group[row].id] = {
          x: xOffset + col * COL_WIDTH,
          y: 40 + row * ROW_HEIGHT,
        };
      }
    }
  } else {
    computeDependencyColumns(templates, wiring).forEach((group, col) => {
      group.forEach((t, row) => {
        positions[t.id] = {
          x: xOffset + col * COL_WIDTH,
          y: 40 + row * ROW_HEIGHT,
        };
      });
    });
  }

  return positions;
}
