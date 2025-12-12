import { useEffect, useMemo, useState } from "react";

import { Box, Card, CardContent, Stack, TextField } from "@mui/material";
import {
  DataGrid,
  GridFilterModel,
  GridSortModel,
  GridPaginationModel,
  GridRenderCellParams,
  GridColDef,
} from "@mui/x-data-grid";

import { useConfig } from "../../../common";
import { useLocalStorage } from "../../../common/context/UIStateContext";
import { AuditLogEntity } from "../../../types";
import { getDateValue, GetReferenceUrlValue } from "../CommonField";

export interface AuditProps {
  entityId: string;
}

interface AuditFilterPanelProps {
  search: string;
  setSearch: (value: string) => void;
}

interface DataGridState {
  sortModel: GridSortModel;
  paginationModel: GridPaginationModel;
}

export const AuditFilterPanel = ({
  search,
  setSearch,
}: AuditFilterPanelProps) => {
  return (
    <Box>
      <Card sx={{ mt: 1 }}>
        <CardContent
          sx={{
            p: 0,
            "&:last-child": { paddingBottom: 0 },
          }}
        >
          <Box sx={{ width: 400 }}>
            <Stack spacing={1}>
              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                label={"Search"}
                slotProps={{ input: { spellCheck: false } }}
              />
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export const Audit = ({ entityId }: AuditProps) => {
  const { ikApi } = useConfig();
  const { get, setKey } = useLocalStorage<Record<string, DataGridState>>();
  const storageKey = "auditTable";
  const savedState = get(storageKey);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntity[]>([]);
  const [search, setSearch] = useState<string>("");

  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });

  const [sortModel, setSortModel] = useState<GridSortModel>(
    savedState?.sortModel || [{ field: "created_at", sort: "desc" }],
  );

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    savedState?.paginationModel || { page: 0, pageSize: 10 },
  );

  useEffect(() => {
    const id = setTimeout(() => {
      const tokens = search
        .split(" ")
        .map((s) => s.trim())
        .filter(Boolean);
      setFilterModel((prev) => ({ ...prev, quickFilterValues: tokens }));
    }, 150);
    return () => clearTimeout(id);
  }, [search]);

  // Save sort and pagination state to localStorage
  useEffect(() => {
    setKey(storageKey, { sortModel, paginationModel });
  }, [sortModel, paginationModel, storageKey, setKey]);

  const handleSortModelChange = (newSortModel: GridSortModel) => {
    setSortModel(newSortModel);
  };

  const handlePaginationModelChange = (
    newPaginationModel: GridPaginationModel,
  ) => {
    setPaginationModel(newPaginationModel);
  };

  useEffect(() => {
    ikApi
      .getList("audit_logs", {
        filter: { entity_id: entityId },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "created_at", order: "DESC" },
      })
      .then(({ data }) => {
        setAuditLogs(data);
      });
  }, [ikApi, entityId]);

  const columns: GridColDef<AuditLogEntity>[] = useMemo(
    () => [
      {
        field: "created_at",
        headerName: "Time",
        flex: 1,
        valueFormatter: (value: string) => getDateValue(value),
      },
      {
        field: "creator",
        headerName: "User",
        flex: 1,
        renderCell: (params: GridRenderCellParams<AuditLogEntity>) => {
          if (!params.row.creator) {
            return "System";
          }
          const creatorData = params.row.creator;
          return <GetReferenceUrlValue {...creatorData} />;
        },
      },
      {
        field: "action",
        headerName: "Event",
        flex: 1,
      },
    ],
    [],
  );

  return (
    <Box>
      <AuditFilterPanel search={search} setSearch={setSearch} />
      <Box>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <DataGrid
                rows={auditLogs}
                columns={columns}
                pagination
                disableColumnFilter
                disableColumnMenu
                disableRowSelectionOnClick
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
                        "aria-labelledby": "audit-pagination-label",
                      },
                      "aria-label": "Rows per page",
                    },
                    labelRowsPerPage: "Rows per page:",
                    labelId: "audit-pagination-label",
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
