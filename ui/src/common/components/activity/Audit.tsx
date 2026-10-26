import { useCallback, useEffect, useMemo, useState } from "react";

import { AuditExecutionResult } from "../../../audit_logs/components/AuditExecutionResult";
import { buildAuditLogsQuery, GqlAuditLog } from "../../../audit_logs/graphql";
import { CommonDialog, useConfig } from "../../../common";
import GradientCircularProgress from "../../../common/GradientCircularProgress";
import { useHashParams } from "../../../common/hooks/useHashParams";
import { usePersistedPagination } from "../../../common/hooks/usePersistedPagination";
import {
  HeroChartBarIcon,
  HeroMagnifyingGlassIcon,
  HeroTableCellsIcon,
} from "../../../icons";
import { REVISION_FIELDS, GqlRevision } from "../../../revision/graphql";
import { AuditLogEntity } from "../../../types";
import {
  Alert,
  Tooltip,
  InputAdornment,
  TextField,
  Tab,
  Tabs,
} from "../../../ui";
import {
  DataTable,
  DataTableColumn,
  PaginationModel,
  RenderCellParams,
  SortModel,
} from "../../../ui";
import {
  LogActionButtons,
  ACTIONS_WITH_LOGS,
} from "../../LogsComponent/LogActionButtons";
import { LogsDialog } from "../../LogsComponent/LogsDialog";
import { Entity } from "../entities/Entity";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../entity_table/tableColumns";
import { RelativeTime } from "../fields/RelativeTime";
import { RevisionChip } from "../labels/RevisionChip";

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

  const [quickFilterValues, setQuickFilterValues] = useState<string[]>([]);

  const [sortModel, setSortModel] = useState<SortModel>([
    { field: "createdAt", sort: "desc" },
  ]);

  const [paginationModel, setPaginationModel] = usePersistedPagination(
    "audit_pageSize",
    10,
    [10, 25, 50, 100],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      const tokens = search
        .split(" ")
        .map((s) => s.trim())
        .filter(Boolean);
      setQuickFilterValues(tokens);
    }, 150);
    return () => clearTimeout(id);
  }, [search]);

  const handleSortModelChange = (newSortModel: SortModel) => {
    setSortModel(newSortModel);
  };

  const handlePaginationModelChange = (newPaginationModel: PaginationModel) => {
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
          "metadata",
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

  const columns: DataTableColumn<AuditLogEntity>[] = useMemo(
    () => [
      ...(showRevisionColumn
        ? [
            {
              field: "revisionNumber",
              headerName: "",
              width: 88,
              minWidth: 88,
              renderCell: (params: RenderCellParams<AuditLogEntity>) => {
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
            } as DataTableColumn<AuditLogEntity>,
          ]
        : []),
      {
        field: "action",
        headerName: "Event",
        flex: 1,
      },
      {
        field: "result",
        headerName: "Result",
        flex: 3,
        sortable: false,
        renderCell: (params: RenderCellParams<AuditLogEntity>) => (
          <div className="flex h-full min-w-0 items-center gap-2">
            <AuditExecutionResult log={params.row} />
            <LogActionButtons
              action={params.row.action}
              sourceCodeLanguage={sourceCodeLanguage}
              onOpenSummary={() => openDialog(params.row.id, "summary")}
              onOpenLogs={() => openDialog(params.row.id, "logs")}
            />
          </div>
        ),
      },
      {
        field: "createdAt",
        headerName: "Time",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        mobile: "badge",
        align: "right",
        headerAlign: "right",
        renderCell: (params: RenderCellParams<AuditLogEntity>) => {
          const creator = params.row.creator;
          return (
            <div className="flex min-w-0 items-center justify-end gap-1.5">
              <RelativeTime date={params.value} compact />
              {creator && (
                <Entity entity={{ ...creator, entityType: "user" }} hideName />
              )}
            </div>
          );
        },
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
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <TextField
          className="w-80 max-w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search audit events…"
          size="small"
          startAdornment={
            <InputAdornment position="start">
              <HeroMagnifyingGlassIcon
                className="text-fg-muted"
                fontSize="small"
              />
            </InputAdornment>
          }
          inputProps={{ spellCheck: false }}
        />
        {showTimelineView && (
          <Tabs
            appearance="segmented"
            value={viewMode}
            onChange={(_, value) => setViewMode(value)}
            aria-label="Audit view"
          >
            <Tab
              value="table"
              aria-label="Table view"
              className="px-3"
              label={
                <Tooltip title="Table view">
                  <HeroTableCellsIcon className="text-[1rem]" />
                </Tooltip>
              }
            />
            <Tab
              value="timeline"
              aria-label="Timeline view"
              className="px-3"
              label={
                <Tooltip title="Timeline view">
                  <HeroChartBarIcon className="text-[1rem]" />
                </Tooltip>
              }
            />
          </Tabs>
        )}
      </div>
      <div className="min-h-75 w-full overflow-x-auto rounded-surface border border-divider bg-paper">
        {viewMode === "table" ? (
          <DataTable
            rows={auditLogs}
            columns={columns}
            className="md:min-h-[380px]"
            mobileCards
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            pageSizeOptions={[10, 25, 50, 100]}
            quickFilterValues={quickFilterValues}
          />
        ) : (
          <div className="p-4">
            <RevisionTimelines
              logs={auditLogs}
              search={search}
              actionsWithLogs={ACTIONS_WITH_LOGS}
              onRevisionClick={(rev) => handleRevisionClick(entityId, rev)}
              onOpenDialog={openDialog}
            />
          </div>
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
              <div className="flex h-[60vh] items-center justify-center">
                <GradientCircularProgress />
              </div>
            ) : revisionDialogRight ? (
              <div className="h-[60vh]">
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
              </div>
            ) : (
              <Alert severity="warning">No diff available</Alert>
            )
          }
        />
      </div>
    </div>
  );
};
