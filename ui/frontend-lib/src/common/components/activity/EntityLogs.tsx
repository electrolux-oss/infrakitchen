import { useCallback, useEffect, useMemo, useState } from "react";

import { Box, Card, CardContent } from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridSortModel,
} from "@mui/x-data-grid";

import {
  dataGridDefaultProps,
  dataGridSx,
} from "../entity_table/dataGridStyles";
import { useConfig } from "../../../common";
import { buildLogsQuery, GqlLog } from "../../../logs/graphql";
import { LogEntity } from "../../../types";
import { LogActionButtons } from "../../LogsComponent/LogActionButtons";
import { LogsDialog } from "../../LogsComponent/LogsDialog";
import { RelativeTime } from "../RelativeTime";

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

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "createdAt", sort: "desc" },
  ]);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

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

  const columns: GridColDef<LogEntity>[] = useMemo(
    () => [
      {
        field: "data",
        headerName: "Action",
        flex: 1,
        renderCell: (params) => (
          <Box
            sx={{
              fontWeight: 500,
              fontSize: "0.875rem",
            }}
          >
            {params.value}
          </Box>
        ),
      },
      {
        field: "createdAt",
        headerName: "Started",
        flex: 0.2,
        renderCell: (params) => <RelativeTime date={params.value} />,
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
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <DataGrid
              rows={logHeads}
              columns={columns}
              loading={loading}
              getRowId={(row) => row.id}
              pagination
              disableRowSelectionOnClick
              {...dataGridDefaultProps}
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[10, 25, 50, 100]}
              sx={{ ...dataGridSx }}
            />
          </Box>
        </CardContent>
      </Card>
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
    </Box>
  );
};
