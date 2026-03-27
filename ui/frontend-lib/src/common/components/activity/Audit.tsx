import { useEffect, useMemo, useState } from "react";

import ArticleIcon from "@mui/icons-material/Article";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridFilterModel,
  GridPaginationModel,
  GridRenderCellParams,
  GridSortModel,
} from "@mui/x-data-grid";

import { CommonDialog, useConfig } from "../../../common";
import { useHashParams } from "../../../common/hooks/useHashParams";
import { AuditLogEntity } from "../../../types";
import { GetReferenceUrlValue } from "../CommonField";
import { RelativeTime } from "../RelativeTime";

import { Logs } from "./Logs";

export interface AuditProps {
  entityId: string;
  useVersionId?: boolean;
}

interface AuditFilterPanelProps {
  search: string;
  setSearch: (value: string) => void;
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

export const Audit = ({ entityId, useVersionId }: AuditProps) => {
  const { ikApi } = useConfig();
  const [hashParams, setHashParams] = useHashParams();

  const actionsWithLogs = useMemo<string[]>(
    () => ["sync", "dryrun", "dryrun_with_temp_state", "execute"],
    [],
  );

  const selectedTraceId = hashParams.get("traceId");
  const selectedVersionId = hashParams.get("versionId");

  const logsOpen = useMemo(() => {
    if (!selectedTraceId) return false;
    if (useVersionId) {
      return selectedVersionId === entityId;
    }
    return true;
  }, [selectedTraceId, selectedVersionId, useVersionId, entityId]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntity[]>([]);
  const [search, setSearch] = useState<string>("");

  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "created_at", sort: "desc" },
  ]);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

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
      {
        field: "created_at",
        headerName: "Time",
        flex: 1,
        renderCell: (params: GridRenderCellParams<AuditLogEntity>) => (
          <RelativeTime date={params.value} sx={{ fontSize: "0.75rem" }} />
        ),
      },
      {
        field: "userActions",
        headerName: "Actions",
        flex: 1,
        renderCell: (params) => (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              height: "100%",
            }}
          >
            {actionsWithLogs.includes(params.row.action) && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArticleIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  const newParams = new URLSearchParams(hashParams);
                  newParams.set("traceId", params.row.id);
                  if (useVersionId) {
                    newParams.set("versionId", entityId);
                  }
                  setHashParams(newParams);
                }}
              >
                Logs
              </Button>
            )}
          </Box>
        ),
      },
    ],
    [actionsWithLogs, hashParams, setHashParams, useVersionId, entityId],
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
              {logsOpen && selectedTraceId && (
                <CommonDialog
                  title="Logs"
                  maxWidth="md"
                  open={logsOpen}
                  onClose={() => {
                    const newParams = new URLSearchParams(hashParams);
                    newParams.delete("traceId");
                    if (useVersionId) {
                      newParams.delete("versionId");
                    }
                    setHashParams(newParams);
                  }}
                  content={
                    <Logs entityId={entityId} traceId={selectedTraceId} />
                  }
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
