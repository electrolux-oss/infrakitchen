import { useState, useMemo } from "react";

import { useEffectOnce } from "react-use";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  GetEntityLink,
  getDateValue,
} from "../../common/components/CommonField";
import { PropertyCard } from "../../common/components/PropertyCard";
import { LogList } from "../../common/LogsComponent/LogList";
import StatusChip from "../../common/StatusChip";
import { BatchOperation } from "../types";

interface BatchOperationEntitiesProps {
  batchOperation: BatchOperation;
}

export const BatchOperationEntities = ({
  batchOperation,
}: BatchOperationEntitiesProps) => {
  const { ikApi } = useConfig();

  const [entities, setEntities] = useState<any[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [logsEntityId, setLogsEntityId] = useState<string | null>(null);

  const loadEntities = async () => {
    if (!batchOperation?.entity_ids || batchOperation.entity_ids.length === 0) {
      setEntities([]);
      return;
    }

    setEntitiesLoading(true);
    try {
      const entityName =
        batchOperation.entity_type === "resource" ? "resources" : "executors";

      // Fetch entities by IDs
      const response = await ikApi.getList(entityName, {
        pagination: { page: 1, perPage: 1000 },
        filter: { id__in: batchOperation.entity_ids },
        sort: { field: "name", order: "ASC" },
      });

      setEntities(response.data || []);
    } catch (_) {
      setEntities([]);
    } finally {
      setEntitiesLoading(false);
    }
  };

  useEffectOnce(() => {
    loadEntities();
  });

  const handleRefresh = () => {
    loadEntities();
  };

  const handleOpenLogs = (entityId: string) => {
    setLogsEntityId(entityId);
  };

  const handleCloseLogs = () => {
    setLogsEntityId(null);
  };

  const entityColumns: GridColDef[] = useMemo(() => {
    const baseColumns: GridColDef[] = [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "state",
        headerName: "State",
        flex: 1,
        valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip
            status={String(params.row.status).toLowerCase()}
            state={String(params.row.state).toLowerCase()}
          />
        ),
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "logs",
        headerName: "Logs",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleOpenLogs(params.row.id)}
          >
            Logs
          </Button>
        ),
      },
    ];

    // Add resource-specific columns
    if (batchOperation?.entity_type === "resource") {
      baseColumns.splice(1, 0, {
        field: "template",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return <GetEntityLink {...template} />;
        },
      });
    }

    return baseColumns;
  }, [batchOperation?.entity_type]);

  return (
    <PropertyCard
      title={`${batchOperation?.entity_type === "resource" ? "Resources" : "Executors"} in Batch`}
      actions={
        <Button
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      }
    >
      <DataGrid
        rows={entities}
        columns={entityColumns}
        autoHeight
        loading={entitiesLoading}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        pageSizeOptions={[10, 25, 50, 100]}
      />
      <Dialog
        open={Boolean(logsEntityId)}
        onClose={handleCloseLogs}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Latest Logs</DialogTitle>
        <DialogContent>
          {logsEntityId && <LogList entity_id={logsEntityId} />}
        </DialogContent>
      </Dialog>
    </PropertyCard>
  );
};
