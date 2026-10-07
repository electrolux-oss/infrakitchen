import { MouseEvent, useCallback, useMemo } from "react";

import { useNavigate } from "react-router";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import {
  Box,
  IconButton,
  MenuItem,
  Pagination,
  Select,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  DataGrid,
  GridFilterModel,
  GridSortModel,
  GridPaginationModel,
  GridColDef,
  GridColumnVisibilityModel,
  GridEventListener,
  useGridApiRef,
} from "@mui/x-data-grid";
import type { GridApi } from "@mui/x-data-grid";

import { useConfig } from "../../context/ConfigContext";
import { ColumnFilterSpec } from "../filter_panel/FilterConfig";

import {
  dataGridClickableRowSx,
  dataGridDefaultProps,
  dataGridPaginationSlotProps,
  dataGridSx,
} from "./dataGridStyles";
import { EntityCardList } from "./EntityCardList";

export type EntityTableColumn = GridColDef<any> & {
  field?: string;
  fetchFields?: string[];
  sortField?: string;
  filter?: ColumnFilterSpec | ColumnFilterSpec[];
  /**
   * Placement in the phone card layout. Defaults: the first non-hideable
   * column is the title, header-less columns are badges, the rest are meta.
   */
  mobile?: "title" | "badge" | "meta" | "hidden";
};

export interface ResourceTableProps {
  entityName: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entities: any[];
  loading: boolean;
  totalRows: number;
  paginationModel?: GridPaginationModel;
  sortModel?: GridSortModel;
  filterModel?: GridFilterModel;
  columnVisibilityModel?: GridColumnVisibilityModel;
  handleSortModelChange?: (model: GridSortModel) => void;
  handlePaginationModelChange?: (model: GridPaginationModel) => void;
  setFilterModel?: (model: GridFilterModel) => void;
  handleColumnVisibilityModelChange?: (
    model: GridColumnVisibilityModel,
  ) => void;
  onRefresh?: () => void;
  /** Set false to remove the row hover affordance (e.g. no detail page). */
  rowClickable?: boolean;
}

type GridPreferencePanelValue = Parameters<
  NonNullable<GridApi["showPreferences"]>
>[0];

export const EntityTable = ({
  entities,
  columns,
  loading,
  totalRows,
  paginationModel,
  sortModel,
  filterModel,
  columnVisibilityModel,
  handleSortModelChange,
  handlePaginationModelChange,
  setFilterModel,
  handleColumnVisibilityModelChange,
  onRefresh,
  rowClickable = true,
}: ResourceTableProps) => {
  const apiRef = useGridApiRef();
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

      const { entityName, id } = row;
      if (!entityName || !id) return;

      const href = `${linkPrefix}${entityName}s/${id}`;
      if (event && (event.metaKey || event.ctrlKey || event.button === 1)) {
        window.open(href, "_blank");
        return;
      }
      void navigate(href);
    },
    [linkPrefix, navigate],
  );

  const handleRowClick: GridEventListener<"rowClick"> = useCallback(
    (params, event) => navigateToRow(params.row, event),
    [navigateToRow],
  );

  const theme = useTheme();
  // Below `sm` the grid is swapped for a stacked card list: a multi-column
  // grid can't fit a phone and community DataGrid can't pin the Name column.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), {
    noSsr: true,
  });

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

    const model: GridColumnVisibilityModel = { ...columnVisibilityModel };

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

  const handleColumnVisibilityClick = () => {
    apiRef.current?.showPreferences?.("columns" as GridPreferencePanelValue);
  };

  // Shared grid chrome (header/footer/rows/cells) lives in `dataGridSx`.
  // Grids whose rows lead to a detail page opt into the pointer affordance.
  const rowAffordanceSx = rowClickable === false ? {} : dataGridClickableRowSx;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.25,
          mt: 1,
          mb: 0.5,
        }}
      >
        {isMobile && sortableColumns.length > 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.25,
              mr: "auto",
              minWidth: 0,
            }}
          >
            <Select
              size="small"
              variant="standard"
              disableUnderline
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
              sx={{ fontSize: "0.8125rem", color: "text.secondary" }}
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
                  size="small"
                  sx={{ p: 0.5 }}
                  aria-label="Toggle sort direction"
                  onClick={toggleMobileSortDirection}
                >
                  {currentSort.sort === "asc" ? (
                    <ArrowUpwardIcon fontSize="small" />
                  ) : (
                    <ArrowDownwardIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            sx={{ p: 0.75 }}
            aria-label="Refresh"
            onClick={onRefresh}
            disabled={!onRefresh}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {!isMobile && (
          <Tooltip title="Show or hide columns">
            <span>
              <IconButton
                size="small"
                sx={{ p: 0.75 }}
                aria-label="Toggle column visibility"
                onClick={handleColumnVisibilityClick}
                disabled={!apiRef.current}
              >
                <ViewColumnIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--template-surface-radius)",
          backgroundColor: "background.paper",
          overflow: "hidden",
        }}
      >
        {isMobile ? (
          <>
            <EntityCardList
              rows={entities}
              columns={columns}
              columnVisibilityModel={effectiveColumnVisibilityModel}
              loading={loading}
              skeletonCount={pageSize}
              emptyLabel={dataGridDefaultProps.localeText.noRowsLabel}
              apiRef={apiRef}
              onRowClick={rowClickable ? navigateToRow : undefined}
            />
            {totalRows > 0 && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                  py: 1,
                  borderTop: "1px solid",
                  borderTopColor: "divider",
                }}
              >
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
                <Typography variant="caption" color="text.secondary">
                  {firstRow}–{lastRow} of {totalRows}
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <DataGrid
              apiRef={apiRef}
              rows={entities}
              rowCount={totalRows}
              autoHeight
              paginationMode="server"
              loading={loading}
              columns={columns}
              pagination
              disableRowSelectionOnClick
              {...(rowClickable ? { onRowClick: handleRowClick } : {})}
              {...dataGridDefaultProps}
              sortModel={sortModel}
              onSortModelChange={handleSortModelChange}
              paginationModel={paginationModel}
              onPaginationModelChange={handlePaginationModelChange}
              pageSizeOptions={[10, 25, 50, 100]}
              filterModel={filterModel}
              onFilterModelChange={setFilterModel}
              columnVisibilityModel={effectiveColumnVisibilityModel}
              onColumnVisibilityModelChange={handleColumnVisibilityModelChange}
              sx={{ ...dataGridSx, ...rowAffordanceSx }}
              slotProps={dataGridPaginationSlotProps("entity-pagination-label")}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
