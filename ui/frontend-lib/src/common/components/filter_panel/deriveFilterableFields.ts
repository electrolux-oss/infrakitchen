import { EntityTableColumn } from "../entity_table/EntityTable";

import {
  ColumnFilterSpec,
  FilterableField,
  FilterDeriveContext,
} from "./FilterConfig";
import { makeLabelsLoader } from "./referenceLoaders";

/**
 * Generic utility that derives FilterableField[] from table columns.
 * Iterates columns, reads each column.filter spec (single or array),
 * and produces the FilterableField list for the advanced filter panel.
 *
 * Columns without a `filter` property are skipped.
 */
export const deriveFilterableFields = (
  columns: EntityTableColumn[],
  ctx: FilterDeriveContext,
): FilterableField[] => {
  const fields: FilterableField[] = [];

  for (const column of columns) {
    if (!column.filter) continue;

    const specs: ColumnFilterSpec[] = Array.isArray(column.filter)
      ? column.filter
      : [column.filter];

    for (const spec of specs) {
      const field: FilterableField = {
        field: spec.field,
        label: spec.label || (column.headerName as string) || spec.field,
        operators: spec.operators,
        valueType: spec.valueType,
        defaultOperator: spec.defaultOperator,
        defaultSelected: spec.defaultSelected,
      };

      // Resolve static select options
      if (spec.selectOptions) {
        field.selectOptions = spec.selectOptions;
      }

      if (spec.options) {
        field.options = spec.options;
      }

      // Resolve the common labels loader directly from the entity name.
      if (!field.options && spec.labelsEntity) {
        field.options = makeLabelsLoader(ctx.ikApi, spec.labelsEntity);
      }

      // Resolve dynamic options from context by key
      if (!field.options && spec.optionsKey && ctx.options?.[spec.optionsKey]) {
        field.options = ctx.options[spec.optionsKey];
      }

      // Resolve reference loader via factory
      if (spec.makeReferenceLoader) {
        field.loadReferenceOptions = spec.makeReferenceLoader(ctx);
      }

      fields.push(field);
    }
  }

  return fields;
};
