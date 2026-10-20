import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfig } from "../../../common";
import { buildLogsQuery, GqlLog } from "../../../logs/graphql";
import { LogEntity } from "../../../types";
import { DataTable, DataTableColumn, SortModel } from "../../../ui";
import { usePersistedPagination } from "../../hooks/usePersistedPagination";
import { LogActionButtons } from "../../LogsComponent/LogActionButtons";
import { LogsDialog } from "../../LogsComponent/LogsDialog";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../entity_table/tableColumns";
import { RelativeTime } from "../fields/RelativeTime";

export interface EntityLogsProps {
  entityId?: string;
  traceId?: string;
  sourceCodeLanguage?: string;
}

export const EntityLogs = ({
  entityId,
  traceId,
  sourceCodeLanguage,
}: EntityLogsProps) => {
  const { ikApi } = useConfig();

  const [logHeads, setLogHeads] = useState<LogEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedLog, setSelectedLog] = useState<{
    executionStart: number;
    action: string;
    view: "summary" | "logs";
    entityId: string;
  } | null>(null);

  const [sortModel, setSortModel] = useState<SortModel>([
    { field: "createdAt", sort: "desc" },
  ]);

  const [paginationModel, setPaginationModel] = usePersistedPagination(
    "entity_logs_pageSize",
    10,
    [10, 25, 50, 100],
  );

  const filter = useMemo(() => {
    const baseFilter: Record<string, any> = {
      level: "header",
    };
    if (traceId) {
      baseFilter.trace_id = traceId;
    }
    if (entityId) {
      baseFilter.entity_id = entityId;
    }
    return baseFilter;
  }, [entityId, traceId]);

  const fetchLogHeads = useCallback(() => {
    setLoading(true);
    ikApi
      .graphqlRequest<{ logs: GqlLog[] }>(
        buildLogsQuery([
          "id",
          "entity_id",
          "data",
          "level",
          "revision",
          "created_at",
          "execution_start",
        ]),
        {
          filter,
          sort: ["created_at", "DESC"],
          range: [0, 600],
        },
      )
      .then((response) => {
        setLogHeads(response.logs || []);
      })
      .catch(() => {
        setLogHeads([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, filter]);

  useEffect(() => {
    fetchLogHeads();
  }, [fetchLogHeads]);

  const columns: DataTableColumn<LogEntity>[] = useMemo(
    () => [
      {
        field: "data",
        headerName: "Action",
        flex: 1,
        renderCell: (params) => (
          <div className="text-[0.875rem] font-medium">{params.value}</div>
        ),
      },
      {
        field: "createdAt",
        headerName: "Started",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        mobile: "badge",
        align: "right",
        headerAlign: "right",
        renderCell: (params) => <RelativeTime date={params.value} compact />,
      },

      {
        field: "revision",
        headerName: "Revision",
        flex: 0.2,
      },
      {
        field: "actions",
        headerName: "",
        flex: 0.5,
        sortable: false,
        renderCell: (params) => (
          <LogActionButtons
            action={"any"}
            sourceCodeLanguage={sourceCodeLanguage}
            onOpenSummary={() =>
              setSelectedLog({
                executionStart: params.row.executionStart,
                action: params.row.data,
                view: "summary",
                entityId: params.row.entityId,
              })
            }
            onOpenLogs={() =>
              setSelectedLog({
                executionStart: params.row.executionStart,
                action: params.row.data,
                view: "logs",
                entityId: params.row.entityId,
              })
            }
          />
        ),
      },
    ],
    [sourceCodeLanguage],
  );

  return (
    <div>
      <div className="w-full overflow-x-auto rounded-surface border border-divider bg-paper">
        <DataTable
          rows={logHeads}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          className="md:min-h-[380px]"
          mobileCards
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
      {selectedLog && (
        <LogsDialog
          entityId={selectedLog.entityId}
          action={selectedLog.action}
          view={selectedLog.view}
          executionStart={selectedLog.executionStart}
          onClose={() => setSelectedLog(null)}
          onViewChange={(view) =>
            setSelectedLog((prev) => (prev ? { ...prev, view } : null))
          }
        />
      )}
    </div>
  );
};
