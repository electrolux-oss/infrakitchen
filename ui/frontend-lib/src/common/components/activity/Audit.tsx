import { useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router";

import ArticleIcon from "@mui/icons-material/Article";
import HistoryIcon from "@mui/icons-material/History";
import SummarizeIcon from "@mui/icons-material/Summarize";
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Tooltip,
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
import { AuditLogEntity } from "../../../types";
import { ENTITY_ACTION } from "../../../utils/constants";
import { GetReferenceUrlValue } from "../CommonField";
import { RelativeTime } from "../RelativeTime";

import { Logs } from "./Logs";

export interface AuditProps {
  entityId: string;
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

export const Audit = ({ entityId }: AuditProps) => {
  const { ikApi } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const actionsWithLogs = useMemo<string[]>(
    () => ["sync", "dryrun", "dryrun_with_temp_state", "execute"],
    [],
  );

  const selectedTraceId = searchParams.get("traceId");
  const selectedView = searchParams.get("view") as
    | "summary"
    | "logs"
    | "revision"
    | null;
  const logsOpen = !!selectedTraceId && !!selectedView;

  const getDialogTitle = (
    view: "summary" | "logs" | "revision",
    action?: string | null,
  ): string => {
    if (view === "logs") return "Logs";
    if (view === "revision") return "Revision";

    switch (action) {
      case ENTITY_ACTION.DRYRUN:
      case ENTITY_ACTION.DRYRUN_WITH_TEMP_STATE:
        return "Plan Summary";
      case ENTITY_ACTION.EXECUTE:
        return "Apply Summary";
      default:
        return "Execution Summary";
    }
  };

  const [auditLogs, setAuditLogs] = useState<AuditLogEntity[]>([]);
  const [search, setSearch] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

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
        headerName: "",
        flex: 1,
        sortable: false,
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
              <>
                {params.row.action !== "sync" && (
                  <Tooltip title="Summary">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAction(params.row.action);
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set("traceId", params.row.id);
                        newParams.set("view", "summary");
                        setSearchParams(newParams);
                      }}
                    >
                      <SummarizeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Logs">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAction(params.row.action);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set("traceId", params.row.id);
                      newParams.set("view", "logs");
                      setSearchParams(newParams);
                    }}
                  >
                    <ArticleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Revision">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAction(params.row.action);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set("traceId", params.row.id);
                      newParams.set("view", "revision");
                      setSearchParams(newParams);
                    }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        ),
      },
    ],
    [actionsWithLogs, searchParams, setSearchParams],
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
              {selectedTraceId && selectedView && (
                <CommonDialog
                  title={getDialogTitle(selectedView, selectedAction)}
                  maxWidth="md"
                  footerActions={false}
                  open={logsOpen}
                  onClose={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete("traceId");
                    newParams.delete("view");
                    setSearchParams(newParams);
                  }}
                  content={
                    <Logs
                      entityId={entityId}
                      traceId={selectedTraceId}
                      eventAction={selectedAction ?? undefined}
                      view={selectedView}
                    />
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
