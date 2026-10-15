import type { ReactNode } from "react";

// Model shapes match the table state persisted in localStorage and URL
// params, so changing them breaks saved views.

export type RowId = string | number;

export type SortDirection = "asc" | "desc" | null | undefined;

export interface SortItem {
  field: string;
  sort: SortDirection;
}

/** Sorted columns, first wins. DataTable sorts by one column at a time. */
export type SortModel = SortItem[];

export interface PaginationModel {
  /** 0-based page. */
  page: number;
  pageSize: number;
}

/** Column field to visibility; absent fields are visible. */
export type ColumnVisibilityModel = Record<string, boolean>;

/** Ids of the selected rows, including rows on other pages. */
export type RowSelectionModel = RowId[];

export interface RenderCellParams<R = any, V = any> {
  id: RowId;
  row: R;
  field: string;
  /** The `valueGetter` result, or `row[field]`. */
  value: V;
}

export interface DataTableColumn<R = any> {
  field: string;
  headerName?: string;
  /** Tooltip on the column header. */
  description?: string;
  /** Fixed width in px (default 100 unless `flex` is set). */
  width?: number;
  minWidth?: number;
  /** Share of the width left over by fixed columns. */
  flex?: number;
  sortable?: boolean;
  /** Set false to keep the column out of the show/hide menu. */
  hideable?: boolean;
  resizable?: boolean;
  /** Accepted for DataGrid compatibility; DataTable has no column filters. */
  filterable?: boolean;
  align?: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right";
  /** Derives the cell value (used for sorting, quick filter and display). */
  valueGetter?: (value: any, row: R) => unknown;
  /** Formats the value when there is no `renderCell`. */
  valueFormatter?: (value: any, row: R) => ReactNode;
  renderCell?: (params: RenderCellParams<R>) => ReactNode;
  /** Client-side sort order for two cell values. */
  sortComparator?: (a: any, b: any) => number;
}
