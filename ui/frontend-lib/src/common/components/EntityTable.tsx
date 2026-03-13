import { useMemo } from "react";

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

export interface ResourceTableProps {
  entityName: string;
  columns: GridColDef<any>[];
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
}

type GridPreferencePanelValue = Parameters<
  NonNullable<GridApiCommunity["showPreferences"]>
>[0];

export const EntityTable = ({
  entityName,
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
}: ResourceTableProps) => {
  const apiRef = useGridApiRef();

  const allColumns = useMemo(() => {
    const existingFields = new Set(columns.map((column) => column.field));
    const inferredColumns: GridColDef<any>[] = [];
    const inferredFields = new Set<string>();

    entities.forEach((entity) => {
      Object.keys(entity ?? {}).forEach((field) => {
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
      });
    });

    return [...columns, ...inferredColumns];
  }, [columns, entities]);

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
          title={`${entityName} (${entities.length})`}
          sx={{ pb: 2 }}
          action={
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
