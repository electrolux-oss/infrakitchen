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
  initialColumnVisibilityModel?: GridColumnVisibilityModel;
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
  initialColumnVisibilityModel,
  handleSortModelChange,
  handlePaginationModelChange,
  setFilterModel,
  handleColumnVisibilityModelChange,
}: ResourceTableProps) => {
  const apiRef = useGridApiRef();
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
              columns={columns}
              pagination
              disableColumnFilter
              disableColumnMenu
              rowHeight={40}
              sortModel={sortModel}
              onSortModelChange={handleSortModelChange}
              paginationModel={paginationModel}
              onPaginationModelChange={handlePaginationModelChange}
              pageSizeOptions={[10, 25, 50, 100]}
              filterModel={filterModel}
              onFilterModelChange={setFilterModel}
              onColumnVisibilityModelChange={handleColumnVisibilityModelChange}
              initialState={
                initialColumnVisibilityModel
                  ? {
                      columns: {
                        columnVisibilityModel: initialColumnVisibilityModel,
                      },
                    }
                  : undefined
              }
              sx={{
                "& .MuiDataGrid-columnHeader": {
                  "& .MuiDataGrid-columnHeaderTitleContainer": {
                    justifyContent: "space-between",
                    flexDirection: "row",
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
