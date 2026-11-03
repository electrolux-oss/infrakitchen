import {
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type ColumnDef,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  type PaginationState,
  type Row,
  type RowData,
  rowPaginationFeature,
  type RowSelectionState,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFns,
  tableFeatures,
  type Updater,
  useTable,
} from "@tanstack/react-table";

import { HeroArrowDownIcon, HeroArrowUpIcon } from "../icons";
import { cn } from "../utils/cn";

import { getCellValue, renderCellContent } from "./cellContent";
import { Checkbox } from "./Checkbox";
import { DataCardList } from "./DataCardList";
import type {
  ColumnVisibilityModel,
  DataTableColumn,
  PaginationModel,
  RowId,
  RowSelectionModel,
  SortModel,
} from "./DataTable.types";
import { Pagination, TablePagination } from "./Pagination";
import { LinearProgress, Skeleton } from "./Progress";
import { Tooltip } from "./Tooltip";
import { useControllable } from "./useControllable";
import { useMediaQuery } from "./useMediaQuery";

export * from "./DataTable.types";
export { renderCellContent };

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
  /** Below `sm`, render rows as stacked cards (see column `mobile`). Not
   * combined with `checkboxSelection`. */
  mobileCards?: boolean;
  emptyLabel?: ReactNode;
  /** Root classes, e.g. a min height floor (`md:min-h-[380px]`). */
  className?: string;
  "aria-label"?: string;
  /**
   * Fit every column to its content (the last one takes the leftover) and
   * keep fitting on later data changes; false restores the even flex split.
   * Switching either way clears widths the user dragged.
   */
  fitColumns?: boolean;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SELECT_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 100;
const DEFAULT_MIN_WIDTH = 50;
/** Cap for a flex column sized from its content, so one long value can't take the whole row. */
const MAX_AUTO_WIDTH = 480;
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

const features = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns,
});
type Features = typeof features;

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
 * columns flex to the container width (or, with `fitColumns`, size to
 * their content and the last one takes the leftover) and resize by dragging
 * the header separators. Row heights, padding and font size come from the
 * --ik-table-* tokens in styles.css.
 */
export function DataTable<R extends RowData = any>({
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
  mobileCards = false,
  emptyLabel = "No Results Found",
  className,
  "aria-label": ariaLabel,
  fitColumns = false,
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

  const columnDefs = useMemo<ColumnDef<Features, R>[]>(
    () =>
      columns.map((column) => ({
        id: column.field,
        accessorFn: (row: R) => getCellValue(column, row),
        enableSorting: column.sortable !== false,
        enableHiding: column.hideable !== false,
        sortFn: column.sortComparator
          ? (a: Row<Features, R>, b: Row<Features, R>, id: string) =>
              column.sortComparator!(a.getValue(id), b.getValue(id))
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

  const table = useTable({
    features,
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

  // Natural (no-wrap) width of each column's content, measured after
  // the rows render: one extra render lays the table out at max-content,
  // reads the cell widths, then switches back to the fixed layout. All of
  // it runs in layout effects, so nothing flashes.
  const tableRef = useRef<HTMLTableElement>(null);
  const [natural, setNatural] = useState<Record<string, number>>({});
  const [measuring, setMeasuring] = useState(false);
  // A fresh measure replaces the widths; otherwise they only grow, so paging
  // or refetching doesn't make columns jump back and forth.
  const freshMeasure = useRef(true);
  const remeasure = useCallback((fresh: boolean) => {
    if (fresh) freshMeasure.current = true;
    setMeasuring(true);
  }, []);
  // Fitting on or off is a fresh layout: drop widths the user dragged.
  // The columnKey effect below does the measuring.
  useLayoutEffect(() => {
    setResized({});
  }, [fitColumns]);
  const columnKey = visibleColumns.map((column) => column.field).join(",");
  useLayoutEffect(() => {
    if (fitColumns) remeasure(true);
  }, [columnKey, fitColumns, remeasure]);
  // A string, so a caller passing a new but equal rows array doesn't re-measure.
  const rowKey = useMemo(
    () => rows.map((row) => String(getRowId(row))).join("|"),
    [rows, getRowId],
  );
  useLayoutEffect(() => {
    if (fitColumns && rows.length > 0) remeasure(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey]);
  // Widths measured with a fallback font are wrong once the web font loads.
  useEffect(() => {
    if (!fitColumns || !document.fonts || document.fonts.status === "loaded") {
      return;
    }
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) remeasure(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fitColumns, remeasure]);
  useLayoutEffect(() => {
    if (!measuring) return;
    const firstRow = tableRef.current?.rows[0];
    const offset = checkboxSelection ? 1 : 0;
    const next: Record<string, number> = {};
    if (firstRow) {
      visibleColumns.forEach((column, index) => {
        const cell = firstRow.cells[index + offset];
        const width = cell ? Math.ceil(cell.getBoundingClientRect().width) : 0;
        if (width > 0) next[column.field] = width;
      });
    }
    const fresh = freshMeasure.current;
    freshMeasure.current = false;
    setNatural((previous) => {
      if (fresh) return next;
      const merged: Record<string, number> = {};
      for (const [field, width] of Object.entries(next)) {
        merged[field] = Math.max(previous[field] ?? 0, width);
      }
      return merged;
    });
    setMeasuring(false);
  }, [measuring, visibleColumns, checkboxSelection]);

  const widths = useMemo(() => {
    const result: number[] = [];
    // Flex columns without a measured width share the free space as before.
    const flexIndexes: number[] = [];
    // Columns sized from content: they absorb the leftover or give way.
    const autoIndexes: number[] = [];
    let used = checkboxSelection ? SELECT_COLUMN_WIDTH : 0;
    let totalFlex = 0;
    visibleColumns.forEach((column, index) => {
      const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH;
      let width: number;
      if (resized[column.field] !== undefined) {
        width = resized[column.field];
      } else if (fitColumns && natural[column.field] !== undefined) {
        width = Math.min(
          MAX_AUTO_WIDTH,
          Math.max(minWidth, natural[column.field]),
        );
        autoIndexes.push(index);
      } else if (column.flex) {
        width = 0;
        totalFlex += column.flex;
        flexIndexes.push(index);
      } else {
        width = Math.max(minWidth, column.width ?? DEFAULT_COLUMN_WIDTH);
      }
      result.push(width);
      used += width;
    });

    const free = Math.max(0, containerWidth - used);
    for (const index of flexIndexes) {
      const column = visibleColumns[index];
      result[index] = Math.max(
        column.minWidth ?? DEFAULT_MIN_WIDTH,
        Math.floor((free * (column.flex ?? 0)) / totalFlex),
      );
    }

    if (flexIndexes.length === 0 && autoIndexes.length > 0 && containerWidth) {
      const leftover = containerWidth - used;
      if (leftover > 0) {
        // Pack columns to the left; the last content-sized flex column
        // (else the last content-sized one) takes the rest.
        const flexAuto = autoIndexes.filter(
          (index) => visibleColumns[index].flex,
        );
        const target = (flexAuto.length > 0 ? flexAuto : autoIndexes).at(-1)!;
        result[target] += leftover;
      } else if (leftover < 0) {
        // Too wide: shrink content-sized columns in proportion to their
        // room above the minimum (cells wrap or truncate as before).
        const room = autoIndexes.map(
          (index) =>
            result[index] -
            (visibleColumns[index].minWidth ?? DEFAULT_MIN_WIDTH),
        );
        const totalRoom = room.reduce((sum, value) => sum + value, 0);
        if (totalRoom > 0) {
          const ratio = Math.min(1, -leftover / totalRoom);
          autoIndexes.forEach((index, i) => {
            result[index] -= Math.floor(room[i] * ratio);
          });
        }
      }
    }
    return result;
  }, [
    visibleColumns,
    resized,
    natural,
    fitColumns,
    containerWidth,
    checkboxSelection,
  ]);

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
  const cellPadding = cn(
    "px-(--ik-table-cell-px)",
    compact ? "py-(--ik-table-cell-py-compact)" : "py-(--ik-table-cell-py)",
  );
  const columnCount = visibleColumns.length + (checkboxSelection ? 1 : 0);

  const handleRowClick = (row: R, event: MouseEvent<HTMLTableRowElement>) => {
    // Links, buttons and inputs inside cells handle their own clicks.
    if ((event.target as Element).closest("a, button, input, label")) return;
    onRowClick?.(row, event);
  };

  const isPhone = useMediaQuery("(max-width: 599.95px)");
  const showCards = mobileCards && isPhone && !checkboxSelection;

  const header = !hideHeader && (
    <thead>
      <tr
        className={
          compact ? "h-(--ik-table-row-h-compact)" : "h-(--ik-table-head-h)"
        }
      >
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
            sorted === "desc" ? HeroArrowDownIcon : HeroArrowUpIcon;
          const label = (
            <span className={cn("min-w-0 truncate", ALIGN[align])}>
              {column.headerName}
            </span>
          );
          const content = sortable ? (
            <button
              type="button"
              onClick={tableColumn?.getToggleSortingHandler()}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-inherit transition-colors hover:text-fg",
                sorted && "text-fg",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                JUSTIFY[align],
              )}
            >
              {label}
              <SortIcon
                fontSize="inherit"
                className={cn(
                  "shrink-0 text-base transition-opacity",
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
              className="relative border-b border-divider px-(--ik-table-cell-px) leading-[1.2]"
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

  if (showCards) {
    const pageCount = Math.max(1, lastPage + 1);
    const page = Math.min(pagination.page, lastPage);
    const firstRow = totalRows === 0 ? 0 : page * pagination.pageSize + 1;
    const lastRow = Math.min(totalRows, (page + 1) * pagination.pageSize);
    return (
      // containerRef stays attached so column widths are right when the
      // viewport grows back to table mode.
      <div ref={containerRef} className={cn("flex w-full flex-col", className)}>
        <DataCardList
          rows={tableRows.map((tableRow) => tableRow.original)}
          columns={visibleColumns}
          getRowId={getRowId}
          loading={loading}
          skeletonCount={SKELETON_ROWS}
          emptyLabel={emptyLabel}
          onRowClick={
            onRowClick
              ? (row, event) =>
                  handleRowClick(row, event as MouseEvent<HTMLTableRowElement>)
              : undefined
          }
        />
        <div className="flex-1" />
        {!hideFooter && totalRows > 0 && (
          <div className="flex flex-col items-center gap-1 border-t border-t-divider py-2">
            {pageCount > 1 && (
              <Pagination
                size="small"
                siblingCount={0}
                count={pageCount}
                page={page + 1}
                onChange={(_event, nextPage) =>
                  setPaginationModel({ ...pagination, page: nextPage - 1 })
                }
              />
            )}
            <span className="text-caption text-fg-muted">
              {firstRow}–{lastRow} of {totalRows}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div ref={containerRef} className="relative w-full overflow-x-auto">
        {loading && tableRows.length > 0 && (
          <LinearProgress className="absolute inset-x-0 top-0 z-[3] h-0.5 rounded-none" />
        )}
        <table
          ref={tableRef}
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className={cn(
            "border-separate border-spacing-0 text-left text-(length:--ik-table-font-size) text-fg",
            measuring
              ? "table-auto [&_:is(td,th)]:whitespace-nowrap"
              : "table-fixed",
          )}
          style={
            measuring
              ? { width: "max-content" }
              : { width: tableWidth, minWidth: "100%" }
          }
        >
          {!measuring && (
            <colgroup>
              {checkboxSelection && (
                <col style={{ width: SELECT_COLUMN_WIDTH }} />
              )}
              {visibleColumns.map((column, index) => (
                <col key={column.field} style={{ width: widths[index] }} />
              ))}
            </colgroup>
          )}
          {header}
          <tbody>
            {showSkeleton &&
              Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={
                    compact
                      ? "h-(--ik-table-row-h-compact)"
                      : "h-(--ik-table-row-h)"
                  }
                >
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
                    "group/row",
                    compact
                      ? "h-(--ik-table-row-h-compact)"
                      : "h-(--ik-table-row-h)",
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
                        "align-middle leading-(--ik-table-line-height) break-words",
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
