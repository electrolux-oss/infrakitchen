import { MouseEvent, ReactNode, useCallback, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import {
  HeroArrowDownIcon,
  HeroArrowPathIcon,
  HeroArrowUpIcon,
  HeroViewColumnsIcon,
} from "../../../icons";
import {
  ColumnVisibilityMenu,
  ColumnVisibilityModel,
  DataCardList,
  DataTable,
  DataTableColumn,
  IconButton,
  MenuItem,
  PaginationModel,
  Pagination,
  Select,
  SortModel,
  Tooltip,
  useMediaQuery,
} from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context/ConfigContext";
import { ColumnFilterSpec } from "../filter_panel/FilterConfig";

const EMPTY_LABEL = "No Results Found";

export type EntityTableColumn = DataTableColumn<any> & {
  fetchFields?: string[];
  sortField?: string;
  filter?: ColumnFilterSpec | ColumnFilterSpec[];
};

export interface ResourceTableProps {
  entityName: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entities: any[];
  loading: boolean;
  totalRows: number;
  paginationModel?: PaginationModel;
  sortModel?: SortModel;
  columnVisibilityModel?: ColumnVisibilityModel;
  handleSortModelChange?: (model: SortModel) => void;
  handlePaginationModelChange?: (model: PaginationModel) => void;
  handleColumnVisibilityModelChange?: (model: ColumnVisibilityModel) => void;
  onRefresh?: () => void;
  /** Set false to remove the row hover affordance (e.g. no detail page). */
  rowClickable?: boolean;
  /** Content rendered between the filter panel and the grid (e.g. quick filter chips). */
  quickFilters?: ReactNode;
  /** Replaces the default navigation to the row's detail page. */
  onRowClick?: (row: any, event?: MouseEvent) => void;
}

export const EntityTable = ({
  entities,
  columns,
  loading,
  totalRows,
  paginationModel,
  sortModel,
  columnVisibilityModel,
  handleSortModelChange,
  handlePaginationModelChange,
  handleColumnVisibilityModelChange,
  onRefresh,
  rowClickable = true,
  quickFilters,
  onRowClick,
}: ResourceTableProps) => {
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  // Rows with an `entityName` + `id` navigate to their detail page, mirroring
  // `EntityLink` URLs (``${linkPrefix}${entityName}s/${id}``).
  const navigateToRow = useCallback(
    (row: { entityName?: string; id?: string }, event?: MouseEvent) => {
      // Links inside cells (e.g. Entity links to related entities) and
      // buttons (e.g. favorite) handle their own clicks; don't also navigate
      // the row to its detail page.
      if ((event?.target as Element | undefined)?.closest("a, button")) return;

      if (onRowClick) {
        onRowClick(row, event);
        return;
      }

      const { entityName, id } = row;
      if (!entityName || !id) return;

      const href = `${linkPrefix}${entityName}s/${id}`;
      if (event && (event.metaKey || event.ctrlKey || event.button === 1)) {
        window.open(href, "_blank");
        return;
      }
      void navigate(href);
    },
    [linkPrefix, navigate, onRowClick],
  );

  // Below `sm` the table is swapped for a stacked card list: a multi-column
  // table can't fit a phone.
  const isMobile = useMediaQuery("(max-width: 599.95px)");

  // Headers are gone in card mode, so sorting moves to a select.
  const sortableColumns = useMemo(
    () =>
      columns.filter(
        (column) =>
          column.sortable !== false &&
          column.headerName &&
          column.mobile !== "hidden",
      ),
    [columns],
  );
  const currentSort = sortModel?.[0];
  const handleMobileSortFieldChange = (field: string) => {
    handleSortModelChange?.(
      field ? [{ field, sort: currentSort?.sort ?? "asc" }] : [],
    );
  };
  const toggleMobileSortDirection = () => {
    if (!currentSort) return;
    handleSortModelChange?.([
      {
        field: currentSort.field,
        sort: currentSort.sort === "asc" ? "desc" : "asc",
      },
    ]);
  };

  const pageSize = paginationModel?.pageSize ?? 10;
  const page = paginationModel?.page ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const firstRow = totalRows === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min(totalRows, (page + 1) * pageSize);

  const effectiveColumnVisibilityModel = useMemo(() => {
    if (!columnVisibilityModel) {
      return columnVisibilityModel;
    }

    const model: ColumnVisibilityModel = { ...columnVisibilityModel };

    columns.forEach((column) => {
      // `hideable: false` columns must stay visible even if a persisted
      // visibility model (e.g. stale localStorage) tries to hide them —
      // otherwise the column can never be shown again (its panel checkbox
      // is disabled) and the grid degrades to "No columns".
      if (column.hideable === false && column.field) {
        model[column.field] = true;
      }
    });

    return model;
  }, [columnVisibilityModel, columns]);

  return (
    <div className="w-full max-w-full">
      {quickFilters && (
        <div className="mt-2 mb-1 flex w-full justify-center">
          {quickFilters}
        </div>
      )}
      <div
        className={cn(
          quickFilters ? "mt-1" : "mt-2",
          "mb-1",
          "flex items-center justify-end gap-0.5",
        )}
      >
        {isMobile && sortableColumns.length > 0 && (
          <div className="mr-auto flex min-w-0 items-center gap-0.5">
            <Select
              className="text-[0.8125rem] text-fg-muted"
              size="small"
              variant="standard"
              displayEmpty
              value={currentSort?.field ?? ""}
              onChange={(event) =>
                handleMobileSortFieldChange(event.target.value)
              }
              inputProps={{ "aria-label": "Sort by" }}
              renderValue={(field) => {
                const column = sortableColumns.find((c) => c.field === field);
                return `Sort: ${column?.headerName ?? "Default"}`;
              }}
            >
              <MenuItem value="">Default</MenuItem>
              {sortableColumns.map((column) => (
                <MenuItem key={column.field} value={column.field}>
                  {column.headerName}
                </MenuItem>
              ))}
            </Select>
            {currentSort && (
              <Tooltip
                title={currentSort.sort === "asc" ? "Ascending" : "Descending"}
              >
                <IconButton
                  className="p-1"
                  size="small"
                  aria-label="Toggle sort direction"
                  onClick={toggleMobileSortDirection}
                >
                  {currentSort.sort === "asc" ? (
                    <HeroArrowUpIcon fontSize="small" />
                  ) : (
                    <HeroArrowDownIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </div>
        )}
        <Tooltip title="Refresh">
          <IconButton
            className="p-1"
            size="small"
            aria-label="Refresh"
            onClick={onRefresh}
            disabled={!onRefresh}
          >
            <HeroArrowPathIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {!isMobile && (
          <Tooltip title="Show or hide columns">
            <span>
              <IconButton
                className="p-1"
                size="small"
                aria-label="Toggle column visibility"
                aria-haspopup="true"
                aria-expanded={Boolean(columnMenuAnchor)}
                onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
              >
                <HeroViewColumnsIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <ColumnVisibilityMenu
          open={Boolean(columnMenuAnchor)}
          anchorEl={columnMenuAnchor}
          onClose={() => setColumnMenuAnchor(null)}
          columns={columns}
          model={effectiveColumnVisibilityModel ?? {}}
          onChange={(model) => handleColumnVisibilityModelChange?.(model)}
        />
      </div>
      <div className="overflow-hidden rounded-surface border border-divider bg-paper">
        {isMobile ? (
          <>
            <DataCardList
              rows={entities}
              columns={columns}
              columnVisibilityModel={effectiveColumnVisibilityModel}
              loading={loading}
              skeletonCount={pageSize}
              emptyLabel={EMPTY_LABEL}
              onRowClick={rowClickable ? navigateToRow : undefined}
            />
            {totalRows > 0 && (
              <div className="flex flex-col items-center gap-1 border-t border-t-divider py-2">
                {pageCount > 1 && (
                  <Pagination
                    size="small"
                    siblingCount={0}
                    count={pageCount}
                    page={page + 1}
                    onChange={(_event, nextPage) =>
                      handlePaginationModelChange?.({
                        page: nextPage - 1,
                        pageSize,
                      })
                    }
                  />
                )}
                <span className="text-caption text-fg-muted">
                  {firstRow}–{lastRow} of {totalRows}
                </span>
              </div>
            )}
          </>
        ) : (
          <DataTable
            className="md:min-h-[380px]"
            rows={entities}
            columns={columns}
            loading={loading}
            emptyLabel={EMPTY_LABEL}
            rowCount={totalRows}
            paginationMode="server"
            sortingMode="server"
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            pageSizeOptions={[10, 25, 50, 100]}
            columnVisibilityModel={effectiveColumnVisibilityModel}
            onRowClick={rowClickable ? navigateToRow : undefined}
          />
        )}
      </div>
    </div>
  );
};
