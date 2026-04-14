import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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
import GradientCircularProgress from "../../../common/GradientCircularProgress";
import { useHashParams } from "../../../common/hooks/useHashParams";
import { RevisionResponse } from "../../../revision/types";
import { AuditLogEntity } from "../../../types";
import { GetEntityLink } from "../CommonField";
import { RelativeTime } from "../RelativeTime";

import { DiffEditor } from "./DiffEditor";
import { Logs } from "./Logs";
import { RevisionTimelines } from "./RevisionTimelines";

const isTerraformLanguage = (lang?: string): boolean =>
  lang === "opentofu" || lang === "terraform";

export interface AuditProps {
  entityId: string;
  useVersionId?: boolean;
  sourceCodeLanguage?: string;
  showRevisionColumn?: boolean;
  showTimelineView?: boolean;
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
  showTimelineView,
}: AuditProps) => {
  const { ikApi } = useConfig();
  const [hashParams, setHashParams] = useHashParams();

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
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  const [revisionDialogLeft, setRevisionDialogLeft] =
    useState<RevisionResponse | null>(null);
  const [revisionDialogRight, setRevisionDialogRight] =
    useState<RevisionResponse | null>(null);
  const [revisionDialogRev, setRevisionDialogRev] = useState<number | null>(
    null,
  );
  const [revisionDialogLoading, setRevisionDialogLoading] = useState(false);

  const handleRevisionClick = useCallback(
    (resourceId: string, rev: number) => {
      setRevisionDialogRev(rev);
      setRevisionDialogLeft(null);
      setRevisionDialogRight(null);
      setRevisionDialogLoading(true);
      const fetches =
        rev === 1
          ? [Promise.resolve(null), ikApi.get(`revisions/${resourceId}/${rev}`)]
          : [
              ikApi.get(`revisions/${resourceId}/${rev - 1}`),
              ikApi.get(`revisions/${resourceId}/${rev}`),
            ];
      Promise.all(fetches)
        .then(([leftRes, rightRes]) => {
          setRevisionDialogLeft(leftRes);
          setRevisionDialogRight(rightRes);
          setRevisionDialogLoading(false);
        })
        .catch(() => {
          setRevisionDialogLoading(false);
        });
    },
    [ikApi],
  );

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

  const openDialog = useCallback(
    (rowId: string, view: "summary" | "logs") => {
      const newParams = new URLSearchParams(hashParams);
      newParams.set("traceId", rowId);
      newParams.set("view", view);
      if (useVersionId) {
        newParams.set("versionId", entityId);
      }
      setHashParams(newParams);
      setHeaderAction(undefined);
    },
    [hashParams, setHashParams, useVersionId, entityId],
  );

  const columns: GridColDef<AuditLogEntity>[] = useMemo(
    () => [
      ...(showRevisionColumn
        ? [
            {
              field: "revision_number",
              headerName: "",
              flex: 0.25,
              renderCell: (params: GridRenderCellParams<AuditLogEntity>) => {
                const rev = params.row.revision_number;
                if (!rev) return null;
                return (
                  <Chip
                    label={`v${rev}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevisionClick(entityId, rev);
                    }}
                  />
                );
              },
            } as GridColDef<AuditLogEntity>,
          ]
        : []),
      {
        field: "action",
        headerName: "Event",
        flex: 1,
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
          return <GetEntityLink {...creatorData} />;
        },
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
                {params.row.action !== "sync" &&
                  isTerraformLanguage(sourceCodeLanguage) && (
                    <Tooltip title="Summary">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDialog(params.row.id, "summary");
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
                      openDialog(params.row.id, "logs");
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
      openDialog,
      entityId,
      sourceCodeLanguage,
      showRevisionColumn,
      handleRevisionClick,
    ],
  );

  return (
    <Box>
      <AuditFilterPanel search={search} setSearch={setSearch} />
      <Box>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            {showTimelineView && (
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, value) => value && setViewMode(value)}
                  size="small"
                  sx={{ "& .MuiToggleButton-root": { py: 0.5 } }}
                >
                  <ToggleButton value="table">
                    <Tooltip title="Table view">
                      <TableRowsIcon sx={{ fontSize: "1rem" }} />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="timeline">
                    <Tooltip title="Timeline view">
                      <TimelineIcon sx={{ fontSize: "1rem" }} />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            <Box sx={{ width: "100%", overflowX: "auto", minHeight: 300 }}>
              {viewMode === "table" ? (
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
              ) : (
                <RevisionTimelines
                  logs={auditLogs}
                  search={search}
                  actionsWithLogs={actionsWithLogs}
                  onRevisionClick={(rev) => handleRevisionClick(entityId, rev)}
                  onOpenDialog={openDialog}
                />
              )}
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
              <CommonDialog
                title={
                  revisionDialogRev === 1
                    ? `v1`
                    : `v${revisionDialogRev! - 1} → v${revisionDialogRev}`
                }
                maxWidth="lg"
                hasFooterActions={false}
                open={revisionDialogRev !== null}
                onClose={() => {
                  setRevisionDialogRev(null);
                  setRevisionDialogLeft(null);
                  setRevisionDialogRight(null);
                }}
                content={
                  revisionDialogLoading ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "60vh",
                      }}
                    >
                      <GradientCircularProgress />
                    </Box>
                  ) : revisionDialogRight ? (
                    <Box sx={{ height: "60vh" }}>
                      <DiffEditor
                        originalText={
                          revisionDialogLeft
                            ? JSON.stringify(revisionDialogLeft.data, null, 2)
                            : ""
                        }
                        modifiedText={JSON.stringify(
                          revisionDialogRight.data,
                          null,
                          2,
                        )}
                      />
                    </Box>
                  ) : (
                    <Alert severity="warning">No diff available</Alert>
                  )
                }
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
