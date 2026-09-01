import { useCallback, useEffect, useMemo, useState } from "react";

import SearchIcon from "@mui/icons-material/Search";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Alert,
  Box,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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

import { buildAuditLogsQuery, GqlAuditLog } from "../../../audit_logs/graphql";
import { CommonDialog, useConfig } from "../../../common";
import GradientCircularProgress from "../../../common/GradientCircularProgress";
import { useHashParams } from "../../../common/hooks/useHashParams";
import { REVISION_FIELDS, GqlRevision } from "../../../revision/graphql";
import { AuditLogEntity } from "../../../types";
import {
  LogActionButtons,
  ACTIONS_WITH_LOGS,
} from "../../LogsComponent/LogActionButtons";
import { LogsDialog } from "../../LogsComponent/LogsDialog";
import { RevisionChip } from "../RevisionChip";
import {
  dataGridDefaultProps,
  dataGridPaginationSlotProps,
  dataGridSx,
} from "../entity_table/dataGridStyles";
import { GetEntityLink } from "../CommonField";
import { RelativeTime } from "../RelativeTime";

import { DiffEditor } from "./DiffEditor";
import { RevisionTimelines } from "./RevisionTimelines";

export interface AuditProps {
  entityId: string;
  useVersionId?: boolean;
  sourceCodeLanguage?: string;
  showRevisionColumn?: boolean;
  showTimelineView?: boolean;
}

export const Audit = ({
  entityId,
  useVersionId,
  sourceCodeLanguage,
  showRevisionColumn,
  showTimelineView,
}: AuditProps) => {
  const { ikApi } = useConfig();
  const [hashParams, setHashParams] = useHashParams();

  const selectedAuditLogId = hashParams.get("auditLogId");
  const selectedTraceId = hashParams.get("traceId");
  const selectedVersionId = hashParams.get("versionId");
  const selectedView = hashParams.get("view") as "summary" | "logs" | null;

  const logsOpen = useMemo(() => {
    if (!selectedAuditLogId || !selectedView) return false;
    if (useVersionId) {
      return selectedVersionId === entityId;
    }
    return true;
  }, [
    selectedAuditLogId,
    selectedView,
    selectedVersionId,
    useVersionId,
    entityId,
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntity[]>([]);
  const [search, setSearch] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  const [revisionDialogLeft, setRevisionDialogLeft] =
    useState<GqlRevision | null>(null);
  const [revisionDialogRight, setRevisionDialogRight] =
    useState<GqlRevision | null>(null);
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
      const query =
        rev === 1
          ? `query RevisionDiff($entityId: UUID!, $rightNum: Int!) {
                    right: revision(entityId: $entityId, revisionNumber: $rightNum) {
                      ${REVISION_FIELDS}
                    }
                  }`
          : `query RevisionDiff($entityId: UUID!, $leftNum: Int!, $rightNum: Int!) {
                    left: revision(entityId: $entityId, revisionNumber: $leftNum) {
                      ${REVISION_FIELDS}
                    }
                    right: revision(entityId: $entityId, revisionNumber: $rightNum) {
                      ${REVISION_FIELDS}
                    }
                  }`;
      ikApi
        .graphqlRequest<{ left?: GqlRevision | null; right: GqlRevision }>(
          query,
          rev === 1
            ? { entityId: resourceId, rightNum: rev }
            : { entityId: resourceId, leftNum: rev - 1, rightNum: rev },
        )
        .then((res) => {
          setRevisionDialogLeft(res.left ? res.left : null);
          setRevisionDialogRight(res.right);
          setRevisionDialogLoading(false);
        })
        .catch(() => {
          setRevisionDialogLoading(false);
        });
    },
    [ikApi],
  );

  const selectedAction = useMemo(() => {
    if (!selectedAuditLogId) return null;
    const matchingRow = auditLogs.find(
      (row) => String(row.id) === String(selectedAuditLogId),
    );
    return matchingRow?.action ?? null;
  }, [auditLogs, selectedAuditLogId]);

  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "createdAt", sort: "desc" },
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
      .graphqlRequest<{ auditLogs: GqlAuditLog[] }>(
        buildAuditLogsQuery([
          "id",
          "action",
          "creator",
          "created_at",
          "revision_number",
        ]),
        {
          filter: { entity_id: entityId },
          sort: ["created_at", "DESC"],
          range: [0, 1000],
        },
      )
      .then((response) => {
        setAuditLogs(response.auditLogs || []);
      });
  }, [ikApi, entityId]);

  const openDialog = useCallback(
    (rowId: string, view: "summary" | "logs") => {
      const newParams = new URLSearchParams(hashParams);
      newParams.set("auditLogId", rowId);
      newParams.set("view", view);
      if (useVersionId) {
        newParams.set("versionId", entityId);
      }
      setHashParams(newParams);
    },
    [hashParams, setHashParams, useVersionId, entityId],
  );

  const columns: GridColDef<AuditLogEntity>[] = useMemo(
    () => [
      ...(showRevisionColumn
        ? [
            {
              field: "revisionNumber",
              headerName: "",
              flex: 0.25,
              renderCell: (params: GridRenderCellParams<AuditLogEntity>) => {
                const rev = params.row.revisionNumber;
                if (!rev) return null;
                return (
                  <RevisionChip
                    revision={rev}
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
        field: "createdAt",
        headerName: "Time",
        flex: 1,
        renderCell: (params: GridRenderCellParams<AuditLogEntity>) => (
          <RelativeTime date={params.value} />
        ),
      },
      {
        field: "userActions",
        headerName: "",
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <LogActionButtons
            action={params.row.action}
            sourceCodeLanguage={sourceCodeLanguage}
            onOpenSummary={() => openDialog(params.row.id, "summary")}
            onOpenLogs={() => openDialog(params.row.id, "logs")}
          />
        ),
      },
    ],
    [
      openDialog,
      entityId,
      sourceCodeLanguage,
      showRevisionColumn,
      handleRevisionClick,
    ],
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1,
          flexWrap: "wrap",
        }}
      >
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search audit events…"
          size="small"
          slotProps={{
            input: {
              spellCheck: false,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 320, maxWidth: "100%" }}
        />
        {showTimelineView && (
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
        )}
      </Box>
      <Box
        sx={{
          width: "100%",
          overflowX: "auto",
          minHeight: 300,
          border: 1,
          borderColor: "divider",
          borderRadius: "var(--template-surface-radius)",
          bgcolor: "background.paper",
        }}
      >
        {viewMode === "table" ? (
          <DataGrid
            rows={auditLogs}
            columns={columns}
            pagination
            disableRowSelectionOnClick
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            pageSizeOptions={[10, 25, 50, 100]}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
            {...dataGridDefaultProps}
            sx={{ ...dataGridSx, bgcolor: "background.paper" }}
            slotProps={dataGridPaginationSlotProps("audit-pagination-label")}
          />
        ) : (
          <RevisionTimelines
            logs={auditLogs}
            search={search}
            actionsWithLogs={ACTIONS_WITH_LOGS}
            onRevisionClick={(rev) => handleRevisionClick(entityId, rev)}
            onOpenDialog={openDialog}
          />
        )}
        {logsOpen &&
          (selectedAuditLogId || selectedTraceId) &&
          selectedView && (
            <LogsDialog
              entityId={entityId}
              action={selectedAction ?? undefined}
              view={selectedView}
              auditLogId={selectedAuditLogId ?? undefined}
              traceId={selectedTraceId ?? undefined}
              onClose={() => {
                const newParams = new URLSearchParams(hashParams);
                newParams.delete("auditLogId");
                newParams.delete("traceId");
                newParams.delete("view");
                if (useVersionId) {
                  newParams.delete("versionId");
                }
                setHashParams(newParams);
              }}
              onViewChange={(view) => {
                const newParams = new URLSearchParams(hashParams);
                if (selectedTraceId) {
                  newParams.set("traceId", selectedTraceId);
                } else if (selectedAuditLogId) {
                  newParams.set("auditLogId", selectedAuditLogId);
                }
                newParams.set("view", view);
                if (useVersionId) {
                  newParams.set("versionId", entityId);
                }
                setHashParams(newParams);
              }}
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
    </Box>
  );
};
