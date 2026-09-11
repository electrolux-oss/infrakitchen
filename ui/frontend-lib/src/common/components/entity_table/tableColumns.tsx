import { GridRenderCellParams } from "@mui/x-data-grid";

import { RelativeTime } from "../fields/RelativeTime";
import { Labels } from "../labels/Labels";

import { EntityTableColumn } from "./EntityTable";

/**
 * Shared fixed width for every relative-time column (Created, Last Updated,
 * Time, …). Relative time text (e.g. "5 minutes ago", "12 months ago") is
 * short, so all time columns use one compact width instead of stretching.
 */
export const RELATIVE_TIME_COLUMN_WIDTH = 160;

/** Options for a relative-time column (renderer = RelativeTime, size small). */
export interface RelativeTimeColumnOptions {
  /** API sort field, when it differs from the column `field`. */
  sortField?: string;
  /**
   * Date accessor, for entities whose API field name differs from the row
   * property (e.g. field "created_at" but `row.createdAt`). Defaults to
   * `params.value`, which matches when the field and row property agree.
   */
  value?: (params: GridRenderCellParams) => string | Date | null | undefined;
  /** Fixed column width; defaults to {@link RELATIVE_TIME_COLUMN_WIDTH}. */
  width?: number;
}

/** Options for the Created + Last Updated column pair. */
export interface CreatedUpdatedColumnOptions {
  createdField?: string;
  updatedField?: string;
  createdSortField?: string;
  updatedSortField?: string;
  createdValue?: (
    params: GridRenderCellParams,
  ) => string | Date | null | undefined;
  updatedValue?: (
    params: GridRenderCellParams,
  ) => string | Date | null | undefined;
}

/** A single "relative time" column (e.g. Created, Last Updated, Time). */
export const relativeTimeColumn = (
  field: string,
  headerName: string,
  options: RelativeTimeColumnOptions = {},
): EntityTableColumn => ({
  field,
  headerName,
  width: options.width ?? RELATIVE_TIME_COLUMN_WIDTH,
  ...(options.sortField ? { sortField: options.sortField } : {}),
  renderCell: (params: GridRenderCellParams) => {
    const date = options.value
      ? options.value(params)
      : (params.value as string | Date | null | undefined);
    return date ? <RelativeTime date={date} /> : null;
  },
});

/** The recurring Created / Last Updated column pair. */
export const createdUpdatedColumns = (
  options: CreatedUpdatedColumnOptions = {},
): EntityTableColumn[] => [
  relativeTimeColumn(options.createdField ?? "createdAt", "Created", {
    sortField: options.createdSortField,
    value: options.createdValue,
  }),
  relativeTimeColumn(options.updatedField ?? "updatedAt", "Last Updated", {
    sortField: options.updatedSortField,
    value: options.updatedValue,
  }),
];

/**
 * The recurring Labels column (compact chips + contains_all filter). The only
 * per-entity difference is the labelsEntity used to load filter options.
 */
export const labelsColumn = (labelsEntity: string): EntityTableColumn => ({
  field: "labels",
  headerName: "Labels",
  flex: 1,
  filter: {
    field: "labels",
    operators: ["contains_all"],
    valueType: "autocomplete-multiple",
    defaultOperator: "contains_all",
    labelsEntity,
  },
  valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
  renderCell: (params: GridRenderCellParams) => (
    <Labels labels={params.row.labels || []} />
  ),
});
