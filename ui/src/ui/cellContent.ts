import { isValidElement, ReactNode } from "react";

import type { DataTableColumn, RowId } from "./DataTable.types";

/** Row value for a column: `valueGetter` result or `row[field]`. */
export function getCellValue<R>(column: DataTableColumn<R>, row: R): unknown {
  const raw = (row as Record<string, unknown> | null)?.[column.field];
  return column.valueGetter ? column.valueGetter(raw, row) : raw;
}

/** What a cell shows: `renderCell`, else the formatted value as text. */
export function renderCellContent<R>(
  column: DataTableColumn<R>,
  row: R,
  id: RowId,
): ReactNode {
  const value = getCellValue(column, row);
  if (column.renderCell) {
    return column.renderCell({ id, row, field: column.field, value });
  }
  const formatted = column.valueFormatter
    ? column.valueFormatter(value, row)
    : value;
  if (formatted === null || formatted === undefined || formatted === false) {
    return null;
  }
  return isValidElement(formatted) ? formatted : String(formatted);
}
