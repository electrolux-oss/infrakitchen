import { Box, CardContent, CardHeader, Card } from "@mui/material";
import {
  DataGrid,
  GridFilterModel,
  GridSortModel,
  GridPaginationModel,
  GridColDef,
} from "@mui/x-data-grid";

export interface ResourceTableProps {
  entityName: string;
  columns: GridColDef<any>[];
  entities: any[];
  loading: boolean;
  totalRows: number;
  paginationModel?: GridPaginationModel;
  sortModel?: GridSortModel;
  filterModel?: GridFilterModel;
  handleSortModelChange?: (model: GridSortModel) => void;
  handlePaginationModelChange?: (model: GridPaginationModel) => void;
  setFilterModel?: (model: GridFilterModel) => void;
}

export const EntityTable = ({
  entityName,
  entities,
  columns,
  loading,
  totalRows,
  paginationModel,
  sortModel,
  filterModel,
  handleSortModelChange,
  handlePaginationModelChange,
  setFilterModel,
}: ResourceTableProps) => {
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
        />
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <DataGrid
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
