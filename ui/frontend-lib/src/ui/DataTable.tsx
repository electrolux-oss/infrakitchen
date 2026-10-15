import {
  isValidElement,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ColumnDef,
  functionalUpdate,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  Updater,
  useReactTable,
} from "@tanstack/react-table";

import { ArrowDownwardIcon, ArrowUpwardIcon } from "../icons/material";
import { cn } from "../utils/cn";

import { Checkbox } from "./Checkbox";
import type {
  ColumnVisibilityModel,
  DataTableColumn,
  PaginationModel,
  RowId,
  RowSelectionModel,
  SortModel,
} from "./DataTable.types";
import { TablePagination } from "./Pagination";
import { LinearProgress, Skeleton } from "./Progress";
import { Tooltip } from "./Tooltip";
import { useControllable } from "./useControllable";

export * from "./DataTable.types";

export interface DataTableProps<R = any> {
  rows: readonly R[];
  columns: readonly DataTableColumn<R>[];
  /** Defaults to `row.id`. */
  getRowId?: (row: R) => RowId;
  loading?: boolean;

  /** "server" leaves rows in the given order and only reports sort changes. */
  sortingMode?: "client" | "server";
  sortModel?: SortModel;
  onSortModelChange?: (model: SortModel) => void;

  /** "server" renders `rows` as the current page of `rowCount` rows. */
  paginationMode?: "client" | "server";
  paginationModel?: PaginationModel;
  onPaginationModelChange?: (model: PaginationModel) => void;
  pageSizeOptions?: number[];
  /** Total rows on the server (server pagination). */
  rowCount?: number;
  /** No footer; without a `paginationModel` every row is shown. */
  hideFooter?: boolean;

  /** Hidden columns; pair with ColumnVisibilityMenu to let users toggle. */
  columnVisibilityModel?: ColumnVisibilityModel;

  /** Leading checkbox column; selection survives paging. */
  checkboxSelection?: boolean;
  rowSelectionModel?: RowSelectionModel;
  onRowSelectionModelChange?: (model: RowSelectionModel) => void;

  /** Client-side search: a row matches when every token is found in one of
   * its visible cell values. */
  quickFilterValues?: string[];

  /** Clicks on links, buttons and inputs inside a row are ignored. */
  onRowClick?: (row: R, event: MouseEvent<HTMLTableRowElement>) => void;
  /** "compact" tightens rows (36px) and the header. */
  density?: "standard" | "compact";
  hideHeader?: boolean;
  emptyLabel?: ReactNode;
  /** Root classes, e.g. a min height floor (`md:min-h-[380px]`). */
  className?: string;
  "aria-label"?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SELECT_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 100;
const DEFAULT_MIN_WIDTH = 50;
const SKELETON_ROWS = 5;
const EMPTY_VISIBILITY: ColumnVisibilityModel = {};

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const JUSTIFY = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

/** Row value for a column: `valueGetter` result or `row[field]`. */
function getCellValue<R>(column: DataTableColumn<R>, row: R): unknown {
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

const defaultGetRowId = (row: any): RowId => row?.id;

const toSorting = (model: SortModel): SortingState =>
  model
    .filter((item) => item.sort)
    .slice(0, 1)
    .map((item) => ({ id: item.field, desc: item.sort === "desc" }));

const fromSorting = (state: SortingState): SortModel =>
  state.map((item) => ({ field: item.id, sort: item.desc ? "desc" : "asc" }));

/** Tracks an element's content width. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Data table on TanStack Table. Takes column definitions (`field`, `flex`,
 * `width`, `valueGetter`, `renderCell`, ...) plus controlled sort,
 * pagination, visibility and selection models. Sorting and pagination run client side or report to the server;
 * columns flex to the container width and resize by dragging the header
 * separators.
 */
export function DataTable<R = any>({
  rows,
  columns,
  getRowId = defaultGetRowId,
  loading = false,
  sortingMode = "client",
  sortModel,
  onSortModelChange,
  paginationMode = "client",
  paginationModel,
  onPaginationModelChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  rowCount,
  hideFooter = false,
  columnVisibilityModel,
  checkboxSelection = false,
  rowSelectionModel,
  onRowSelectionModelChange,
  quickFilterValues,
  onRowClick,
  density = "standard",
  hideHeader = false,
  emptyLabel = "No Results Found",
  className,
  "aria-label": ariaLabel,
}: DataTableProps<R>) {
  const compact = density === "compact";
  const paginated = !hideFooter || paginationModel !== undefined;

  const [sorting, setSortModel] = useControllable(
    sortModel,
    [],
    onSortModelChange,
  );
  const [pagination, setPaginationModel] = useControllable(
    paginationModel,
    { page: 0, pageSize: pageSizeOptions[0] ?? 100 },
    onPaginationModelChange,
  );
  // Visibility changes come from ColumnVisibilityMenu, owned by the caller.
  const visibility = columnVisibilityModel ?? EMPTY_VISIBILITY;
  const [selection, setSelectionModel] = useControllable(
    rowSelectionModel,
    [],
    onRowSelectionModelChange,
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibility[column.field] !== false),
    [columns, visibility],
  );

  // Quick filter runs before TanStack so counts and paging see the result.
  const filteredRows = useMemo(() => {
    const tokens = (quickFilterValues ?? [])
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) return rows;
    return rows.filter((row) => {
      const values = visibleColumns.map((column) =>
        String(getCellValue(column, row) ?? "").toLowerCase(),
      );
      return tokens.every((token) =>
        values.some((value) => value.includes(token)),
      );
    });
  }, [rows, quickFilterValues, visibleColumns]);

  const columnDefs = useMemo<ColumnDef<R>[]>(
    () =>
      columns.map((column) => ({
        id: column.field,
        accessorFn: (row: R) => getCellValue(column, row),
        enableSorting: column.sortable !== false,
        enableHiding: column.hideable !== false,
        sortingFn: column.sortComparator
          ? (a, b, id) => column.sortComparator!(a.getValue(id), b.getValue(id))
          : "auto",
      })),
    [columns],
  );

  const sortingState = useMemo(() => toSorting(sorting), [sorting]);
  const paginationState = useMemo<PaginationState>(
    () => ({ pageIndex: pagination.page, pageSize: pagination.pageSize }),
    [pagination.page, pagination.pageSize],
  );
  const selectionState = useMemo<RowSelectionState>(
    () => Object.fromEntries(selection.map((id) => [String(id), true])),
    [selection],
  );

  const serverPaging = paginationMode === "server";
  const totalRows = serverPaging
    ? (rowCount ?? filteredRows.length)
    : filteredRows.length;

  const table = useReactTable<R>({
    data: filteredRows as R[],
    columns: columnDefs,
    getRowId: (row) => String(getRowId(row)),
    state: {
      sorting: sortingState,
      pagination: paginationState,
      columnVisibility: visibility,
      rowSelection: selectionState,
    },
    onSortingChange: (updater: Updater<SortingState>) =>
      setSortModel(fromSorting(functionalUpdate(updater, sortingState))),
    onPaginationChange: (updater: Updater<PaginationState>) => {
      const next = functionalUpdate(updater, paginationState);
      setPaginationModel({ page: next.pageIndex, pageSize: next.pageSize });
    },
    onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
      const next = functionalUpdate(updater, selectionState);
      // Keep the caller's id types (numbers stay numbers).
      const known = new Map(selection.map((id) => [String(id), id]));
      filteredRows.forEach((row) => {
        const id = getRowId(row);
        known.set(String(id), id);
      });
      setSelectionModel(
        Object.keys(next)
          .filter((key) => next[key])
          .map((key) => known.get(key) ?? key),
      );
    },
    enableRowSelection: checkboxSelection,
    enableMultiSort: false,
    // DataGrid order: ascending, descending, unsorted.
    sortDescFirst: false,
    manualSorting: sortingMode === "server",
    manualPagination: serverPaging || !paginated,
    rowCount: totalRows,
    // DataGrid keeps the page when rows change; we clamp below instead.
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel:
      sortingMode === "client" ? getSortedRowModel() : undefined,
    getPaginationRowModel:
      paginated && !serverPaging ? getPaginationRowModel() : undefined,
  });

  // A shrinking client-side result can leave the page past the end.
  const lastPage = Math.max(0, Math.ceil(totalRows / pagination.pageSize) - 1);
  useEffect(() => {
    if (paginated && !serverPaging && pagination.page > lastPage) {
      setPaginationModel({ ...pagination, page: lastPage });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPage, pagination.page]);

  /* ------------------------------------------------------------ widths */

  const [containerRef, containerWidth] = useWidth();
  // Widths the user dragged to; these columns stop flexing.
  const [resized, setResized] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<string | null>(null);

  const widths = useMemo(() => {
    let fixed = checkboxSelection ? SELECT_COLUMN_WIDTH : 0;
    let totalFlex = 0;
    for (const column of visibleColumns) {
      if (resized[column.field] !== undefined) fixed += resized[column.field];
      else if (column.flex) totalFlex += column.flex;
      else fixed += column.width ?? DEFAULT_COLUMN_WIDTH;
    }
    const free = Math.max(0, containerWidth - fixed);
    return visibleColumns.map((column) => {
      const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH;
      if (resized[column.field] !== undefined) return resized[column.field];
      if (column.flex) {
        return Math.max(minWidth, Math.floor((free * column.flex) / totalFlex));
      }
      return Math.max(minWidth, column.width ?? DEFAULT_COLUMN_WIDTH);
    });
  }, [visibleColumns, resized, containerWidth, checkboxSelection]);

  const tableWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    (checkboxSelection ? SELECT_COLUMN_WIDTH : 0);

  const startResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    column: DataTableColumn<R>,
    startWidth: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH;
    handle.setPointerCapture(event.pointerId);
    setResizing(column.field);
    const move = (moveEvent: PointerEvent) =>
      setResized((previous) => ({
        ...previous,
        [column.field]: Math.max(
          minWidth,
          Math.round(startWidth + moveEvent.clientX - startX),
        ),
      }));
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setResizing(null);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  /* ------------------------------------------------------------ render */

  const tableRows = table.getRowModel().rows;
  const isEmpty = !loading && tableRows.length === 0;
  const showSkeleton = loading && tableRows.length === 0;
  const cellPadding = compact ? "px-2.5 py-0.5" : "px-2.5 py-2.5";
  const columnCount = visibleColumns.length + (checkboxSelection ? 1 : 0);

  const handleRowClick = (row: R, event: MouseEvent<HTMLTableRowElement>) => {
    // Links, buttons and inputs inside cells handle their own clicks.
    if ((event.target as Element).closest("a, button, input, label")) return;
    onRowClick?.(row, event);
  };

  const header = !hideHeader && (
    <thead>
      <tr className={compact ? "h-9" : "h-14"}>
        {checkboxSelection && (
          <th className="border-b border-divider px-0 text-center">
            <Checkbox
              className="m-0 align-middle"
              aria-label="Select all rows on this page"
              checked={table.getIsAllPageRowsSelected()}
              ref={(input) => {
                if (input) {
                  input.indeterminate =
                    table.getIsSomePageRowsSelected() &&
                    !table.getIsAllPageRowsSelected();
                }
              }}
              onChange={(_event, checked) =>
                table.toggleAllPageRowsSelected(checked)
              }
            />
          </th>
        )}
        {visibleColumns.map((column, index) => {
          const tableColumn = table.getColumn(column.field);
          const sorted = tableColumn?.getIsSorted() ?? false;
          const sortable = tableColumn?.getCanSort() ?? false;
          const isLast = index === visibleColumns.length - 1;
          const resizable = column.resizable !== false && !isLast;
          const align = column.headerAlign ?? column.align ?? "left";
          const SortIcon =
            sorted === "desc" ? ArrowDownwardIcon : ArrowUpwardIcon;
          const label = (
            <span className={cn("min-w-0 flex-1 truncate", ALIGN[align])}>
              {column.headerName}
            </span>
          );
          const content = sortable ? (
            <button
              type="button"
              onClick={tableColumn?.getToggleSortingHandler()}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-inherit",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                JUSTIFY[align],
              )}
            >
              {label}
              <SortIcon
                fontSize="inherit"
                className={cn(
                  "text-[1.125rem] transition-opacity",
                  sorted
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-50 group-focus-visible:opacity-50",
                )}
              />
            </button>
          ) : (
            <div className={cn("flex w-full items-center", JUSTIFY[align])}>
              {label}
            </div>
          );
          return (
            <th
              key={column.field}
              scope="col"
              aria-sort={
                sorted === "asc"
                  ? "ascending"
                  : sorted === "desc"
                    ? "descending"
                    : undefined
              }
              className="relative border-b border-divider px-2.5 text-[0.8125rem] leading-[1.2] font-medium text-fg-muted"
            >
              {column.description ? (
                <Tooltip title={column.description}>{content}</Tooltip>
              ) : (
                content
              )}
              {!isLast && (
                // Hairline between headers, which doubles as the 10px
                // drag-to-resize handle on resizable columns.
                <div
                  aria-hidden
                  onPointerDown={
                    resizable
                      ? (event) => startResize(event, column, widths[index])
                      : undefined
                  }
                  className={cn(
                    "absolute top-0 right-0 z-[1] flex h-full w-2.5 translate-x-1/2 items-center justify-center",
                    "after:block after:h-4 after:w-px after:bg-divider after:content-['']",
                    resizable &&
                      "cursor-col-resize touch-none hover:after:h-[60%] hover:after:bg-primary",
                    resizing === column.field &&
                      "after:h-[60%] after:bg-primary",
                  )}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div ref={containerRef} className="relative w-full overflow-x-auto">
        {loading && tableRows.length > 0 && (
          <LinearProgress className="absolute inset-x-0 top-0 z-[3] h-0.5 rounded-none" />
        )}
        <table
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className="table-fixed border-separate border-spacing-0 text-left text-[0.875rem] text-fg"
          style={{ width: tableWidth, minWidth: "100%" }}
        >
          <colgroup>
            {checkboxSelection && (
              <col style={{ width: SELECT_COLUMN_WIDTH }} />
            )}
            {visibleColumns.map((column, index) => (
              <col key={column.field} style={{ width: widths[index] }} />
            ))}
          </colgroup>
          {header}
          <tbody>
            {showSkeleton &&
              Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                <tr key={rowIndex} className={compact ? "h-9" : "h-[52px]"}>
                  {Array.from({ length: columnCount }).map((_, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        cellPadding,
                        (rowIndex > 0 || hideHeader) &&
                          "border-t border-divider",
                      )}
                    >
                      <Skeleton variant="text" />
                    </td>
                  ))}
                </tr>
              ))}
            {tableRows.map((tableRow, rowIndex) => {
              const row = tableRow.original;
              const id = getRowId(row);
              const selected = tableRow.getIsSelected();
              return (
                <tr
                  key={tableRow.id}
                  aria-selected={checkboxSelection ? selected : undefined}
                  onClick={
                    onRowClick
                      ? (event) => handleRowClick(row, event)
                      : undefined
                  }
                  // Middle click, so callers can open the row in a new tab.
                  onAuxClick={
                    onRowClick
                      ? (event) =>
                          event.button === 1 && handleRowClick(row, event)
                      : undefined
                  }
                  className={cn(
                    compact ? "h-9" : "h-[52px]",
                    onRowClick
                      ? "cursor-pointer hover:bg-primary/8"
                      : "hover:bg-primary/3",
                    selected && "bg-primary/8",
                  )}
                >
                  {checkboxSelection && (
                    <td
                      className={cn(
                        "px-0 text-center",
                        rowIndex > 0 && "border-t border-divider",
                      )}
                    >
                      <Checkbox
                        className="m-0 align-middle"
                        aria-label="Select row"
                        checked={selected}
                        disabled={!tableRow.getCanSelect()}
                        onChange={(_event, checked) =>
                          tableRow.toggleSelected(checked)
                        }
                      />
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.field}
                      className={cn(
                        cellPadding,
                        "align-middle leading-[1.4] break-words",
                        ALIGN[column.align ?? "left"],
                        rowIndex > 0 && "border-t border-divider",
                      )}
                    >
                      {renderCellContent(column, row, id)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center py-12 text-body2 text-fg-muted">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {!hideFooter && (
        <TablePagination
          className="border-t border-divider"
          count={totalRows}
          page={Math.min(pagination.page, lastPage)}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={pageSizeOptions}
          onPageChange={(_event, page) =>
            setPaginationModel({ ...pagination, page })
          }
          onRowsPerPageChange={(event) =>
            setPaginationModel({
              page: 0,
              pageSize: Number(event.target.value),
            })
          }
        />
      )}
    </div>
  );
}
