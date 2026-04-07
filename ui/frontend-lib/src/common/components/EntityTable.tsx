import { useMemo } from "react";

import InfoOutlined from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import {
  Box,
  CardContent,
  CardHeader,
  Card,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  DataGrid,
  GridFilterModel,
  GridSortModel,
  GridPaginationModel,
  GridColDef,
  GridColumnVisibilityModel,
  useGridApiRef,
} from "@mui/x-data-grid";
import type { GridApiCommunity } from "@mui/x-data-grid/models/api/gridApiCommunity";

export type EntityTableColumn = GridColDef<any> & {
  field?: string;
  fetchFields?: string[];
};

export interface ResourceTableProps {
  entityName: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entities: any[];
  loading: boolean;
  totalRows: number;
  availableFields?: string[];
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
}

type GridPreferencePanelValue = Parameters<
  NonNullable<GridApiCommunity["showPreferences"]>
>[0];

export const EntityTable = ({
  entityName,
  subtitle,
  entities,
  columns,
  loading,
  totalRows,
  availableFields,
  paginationModel,
  sortModel,
  filterModel,
  columnVisibilityModel,
  handleSortModelChange,
  handlePaginationModelChange,
  setFilterModel,
  handleColumnVisibilityModelChange,
  onRefresh,
}: ResourceTableProps) => {
  const apiRef = useGridApiRef();

  const allColumns = useMemo(() => {
    const existingFields = new Set(columns.map((column) => column.field));
    const inferredColumns: EntityTableColumn[] = [];
    const inferredFields = new Set<string>();

    const addInferredField = (field: string) => {
      if (field === "_entity_name") {
        return;
      }

      if (existingFields.has(field) || inferredFields.has(field)) {
        return;
      }

      inferredFields.add(field);
      inferredColumns.push({
        field,
        headerName: field
          .split("_")
          .map((segment) =>
            segment.length > 0
              ? segment.charAt(0).toUpperCase() + segment.slice(1)
              : segment,
          )
          .join(" "),
        flex: 1,
        valueGetter: (_value: any, row: any) => {
          const value = row?.[field];

          if (value === null || value === undefined) {
            return "";
          }

          if (typeof value === "object") {
            try {
              return JSON.stringify(value);
            } catch {
              return String(value);
            }
          }

          return String(value);
        },
      });
    };

    availableFields?.forEach((field) => {
      addInferredField(field);
    });

    entities.forEach((entity) => {
      Object.keys(entity ?? {}).forEach((field) => {
        addInferredField(field);
      });
    });

    return [...columns, ...inferredColumns];
  }, [availableFields, columns, entities]);

  const effectiveColumnVisibilityModel = useMemo(() => {
    if (!columnVisibilityModel) {
      return columnVisibilityModel;
    }

    const model: GridColumnVisibilityModel = { ...columnVisibilityModel };

    allColumns.forEach((column) => {
      if (columns.some((baseColumn) => baseColumn.field === column.field)) {
        return;
      }

      if (model[column.field] === undefined) {
        model[column.field] = false;
      }
    });

    return model;
  }, [allColumns, columnVisibilityModel, columns]);

  const handleColumnVisibilityClick = () => {
    apiRef.current?.showPreferences?.("columns" as GridPreferencePanelValue);
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1400,
      }}
    >
      <Card sx={{ mt: 2 }}>
        <CardHeader
          title={
            <Box display="flex" alignItems="center">
              {entityName}
              <Box
                component="span"
                sx={{ ml: 1 }}
              >{`(${entities.length})`}</Box>
              {subtitle && (
                <Tooltip title={subtitle} arrow>
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      color: "info.main",
                      fontSize: 16,
                    }}
                    tabIndex={0}
                  >
                    <InfoOutlined fontSize="inherit" />
                  </Box>
                </Tooltip>
              )}
            </Box>
          }
          sx={{ pb: 2 }}
          action={
            <Box display="flex" alignItems="center" gap={0.5}>
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
          }
        />
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <DataGrid
              apiRef={apiRef}
              rows={entities}
              rowCount={totalRows}
              paginationMode="server"
              loading={loading}
              columns={allColumns}
              pagination
              disableColumnFilter
              disableColumnMenu
              getRowHeight={() => "auto"}
              sortModel={sortModel}
              onSortModelChange={handleSortModelChange}
              paginationModel={paginationModel}
              onPaginationModelChange={handlePaginationModelChange}
              pageSizeOptions={[10, 25, 50, 100]}
              filterModel={filterModel}
              onFilterModelChange={setFilterModel}
              columnVisibilityModel={effectiveColumnVisibilityModel}
              onColumnVisibilityModelChange={handleColumnVisibilityModelChange}
              sx={{
                "& .MuiDataGrid-columnHeader": {
                  "& .MuiDataGrid-columnHeaderTitleContainer": {
                    justifyContent: "space-between",
                    flexDirection: "row",
                  },
                  "& .MuiButtonBase-root": {
                    border: "none",
                  },
                },
                "& .MuiDataGrid-cell": {
                  alignItems: "flex-start",
                  py: 1,
                },
                "& .MuiDataGrid-cellContent": {
                  whiteSpace: "normal",
                  overflow: "visible",
                  textOverflow: "clip",
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                },
                "& .MuiTablePagination-root": {
                  "& .MuiButtonBase-root": {
                    border: "none",
                  },
                },
              }}
              slotProps={{
                pagination: {
                  SelectProps: {
                    inputProps: {
                      "aria-label": "Rows per page",
                      "aria-labelledby": "entity-pagination-label",
                    },
                    "aria-label": "Rows per page",
                  },
                  labelRowsPerPage: "Rows per page:",
                  labelId: "entity-pagination-label",
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
