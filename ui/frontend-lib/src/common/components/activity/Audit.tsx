import { ReactNode, useEffect, useMemo, useState } from "react";

import { Link, useLocation } from "react-router";

import { Icon } from "@iconify/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
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

const isTerraformLanguage = (lang?: string): boolean =>
  lang === "opentofu" || lang === "terraform";

export interface AuditProps {
  entityId: string;
  useVersionId?: boolean;
  sourceCodeLanguage?: string;
  showRevisionColumn?: boolean;
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
      <Card>
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

const getDialogTitle = (
  view: "summary" | "logs",
  action?: string | null,
): string => {
  if (view === "logs") return "Logs";

  switch (action) {
    case "dryrun":
    case "dryrun_with_temp_state":
      return "Plan Summary";
    case "execute":
      return "Apply Summary";
    default:
      return "Execution Summary";
  }
};

export const Audit = ({
  entityId,
  useVersionId,
  sourceCodeLanguage,
  showRevisionColumn,
}: AuditProps) => {
  const { ikApi } = useConfig();
  const [hashParams, setHashParams] = useHashParams();
  const location = useLocation();

  const actionsWithLogs = useMemo<string[]>(
    () => ["sync", "dryrun", "dryrun_with_temp_state", "execute"],
    [],
  );

  const selectedTraceId = hashParams.get("traceId");
  const selectedVersionId = hashParams.get("versionId");
  const selectedView = hashParams.get("view") as "summary" | "logs" | null;

  const logsOpen = useMemo(() => {
    if (!selectedTraceId || !selectedView) return false;
    if (useVersionId) {
      return selectedVersionId === entityId;
    }
    return true;
  }, [
    selectedTraceId,
    selectedView,
    selectedVersionId,
    useVersionId,
    entityId,
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntity[]>([]);
  const [search, setSearch] = useState<string>("");
  const [headerAction, setHeaderAction] = useState<ReactNode>(undefined);

  const selectedAction = useMemo(() => {
    if (!selectedTraceId) return null;
    const matchingRow = auditLogs.find(
      (row) => String(row.id) === String(selectedTraceId),
    );
    return matchingRow?.action ?? null;
  }, [auditLogs, selectedTraceId]);

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
      ...(showRevisionColumn
        ? [
            {
              field: "revision_number",
              headerName: "Revision",
              flex: 0.5,
              renderCell: (params: GridRenderCellParams<AuditLogEntity>) => {
                const rev = params.row.revision_number;
                if (!rev) return null;
                const parts = location.pathname.replace(/\/$/, "").split("/");
                parts[parts.length - 1] = "revisions";
                const target = `${parts.join("/")}?left=${rev - 1}&right=${rev}`;
                return (
                  <Link
                    to={target}
                    style={{ textDecoration: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rev}
                  </Link>
                );
              },
            } as GridColDef<AuditLogEntity>,
          ]
        : []),
      {
        field: "userActions",
        headerName: "",
        flex: 0.5,
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
                {params.row.action !== "sync" &&
                  isTerraformLanguage(sourceCodeLanguage) && (
                    <Tooltip title="Summary">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newParams = new URLSearchParams(hashParams);
                          newParams.set("traceId", params.row.id);
                          newParams.set("view", "summary");
                          if (useVersionId) {
                            newParams.set("versionId", entityId);
                          }
                          setHashParams(newParams);
                          setHeaderAction(undefined);
                        }}
                      >
                        <AutoAwesomeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                <Tooltip title="Logs">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newParams = new URLSearchParams(hashParams);
                      newParams.set("traceId", params.row.id);
                      newParams.set("view", "logs");
                      if (useVersionId) {
                        newParams.set("versionId", entityId);
                      }
                      setHashParams(newParams);
                      setHeaderAction(undefined);
                    }}
                  >
                    <Icon icon="ix:log" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        ),
      },
    ],
    [
      actionsWithLogs,
      hashParams,
      setHashParams,
      useVersionId,
      entityId,
      sourceCodeLanguage,
      showRevisionColumn,
      location,
    ],
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
                    "& .MuiButtonBase-root": {
                      border: "none",
                    },
                  },
                  "& .MuiTablePagination-root": {
                    "& .MuiButtonBase-root": {
                      border: "none",
                    },
                  },
                  "& .MuiDataGrid-row": {
                    "&:hover": {
                      backgroundColor: (theme) =>
                        alpha(theme.palette.primary.main, 0.08),
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
              {logsOpen && selectedTraceId && selectedView && (
                <CommonDialog
                  title={getDialogTitle(selectedView, selectedAction)}
                  maxWidth="md"
                  hasFooterActions={false}
                  open={logsOpen}
                  onClose={() => {
                    const newParams = new URLSearchParams(hashParams);
                    newParams.delete("traceId");
                    newParams.delete("view");
                    if (useVersionId) {
                      newParams.delete("versionId");
                    }
                    setHashParams(newParams);
                    setHeaderAction(undefined);
                  }}
                  headerAction={headerAction}
                  content={
                    <Logs
                      entityId={entityId}
                      traceId={selectedTraceId}
                      eventAction={selectedAction ?? undefined}
                      view={selectedView}
                      onHeaderActionReady={setHeaderAction}
                      onOpenLogs={() => {
                        const newParams = new URLSearchParams(hashParams);
                        newParams.set("traceId", selectedTraceId);
                        newParams.set("view", "logs");
                        if (useVersionId) {
                          newParams.set("versionId", entityId);
                        }
                        setHashParams(newParams);
                      }}
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
