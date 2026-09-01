import { useCallback, useMemo } from "react";

import { useNavigate } from "react-router";

import RefreshIcon from "@mui/icons-material/Refresh";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import { Box, IconButton, Tooltip } from "@mui/material";
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

export type EntityTableColumn = GridColDef<any> & {
  field?: string;
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
  // `GetEntityLink` URLs (``${linkPrefix}${entityName}s/${id}``).
  const handleRowClick: GridEventListener<"rowClick"> = useCallback(
    (params, event) => {
      const row = params.row as { entityName?: string; id?: string };
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
          gap: 0.5,
          mt: 2,
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              aria-label="Refresh"
              onClick={onRefresh}
              disabled={!onRefresh}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Show or hide columns">
            <span>
              <IconButton
                size="small"
                aria-label="Toggle column visibility"
                onClick={handleColumnVisibilityClick}
                disabled={!apiRef.current}
              >
                <ViewColumnIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
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
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <DataGrid
            apiRef={apiRef}
            rows={entities}
            rowCount={totalRows}
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
      </Box>
    </Box>
  );
};
