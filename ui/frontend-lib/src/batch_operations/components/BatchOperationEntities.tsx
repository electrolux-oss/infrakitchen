import { useState, useMemo, useCallback, useEffect } from "react";

import { FormProvider, useForm } from "react-hook-form";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridRenderCellParams,
  GridRowSelectionModel,
} from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  GetEntityLink,
  getDateValue,
} from "../../common/components/CommonField";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useLocalStorage } from "../../common/context/UIStateContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { LogList } from "../../common/LogsComponent/LogList";
import StatusChip from "../../common/StatusChip";
import { BatchOperation, BatchOperationCreate } from "../types";

import { BatchOperationEntitySelector } from "./BatchOperationEntitySelector";

interface BatchOperationEntitiesProps {
  batchOperation: BatchOperation;
}

export const BatchOperationEntities = ({
  batchOperation,
}: BatchOperationEntitiesProps) => {
  const { ikApi } = useConfig();

  const [entities, setEntities] = useState<any[]>([]);
  const [entityIds, setEntityIds] = useState<string[]>(
    batchOperation.entity_ids || [],
  );
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [logsEntityId, setLogsEntityId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"dryrun" | "execute" | null>(
    null,
  );
  const [actionResults, setActionResults] = useState<
    Record<
      string,
      { status: "pending" | "success" | "error"; message?: string }
    >
  >({});
  const [actionRunning, setActionRunning] = useState(false);

  const storageKey = "batch_operation_entities";
  const { get, setKey } =
    useLocalStorage<Record<string, GridPaginationModel>>();
  const savedPagination = get(storageKey);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    savedPagination || { page: 0, pageSize: 25 },
  );

  const addForm = useForm<BatchOperationCreate>({
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      entity_type: batchOperation.entity_type,
      entity_ids: [],
    },
  });

  const loadEntities = useCallback(async () => {
    if (!entityIds || entityIds.length === 0) {
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
        filter: { id__in: entityIds },
        sort: { field: "name", order: "ASC" },
        fields:
          batchOperation.entity_type === "resource"
            ? ["id", "name", "state", "status", "created_at", "template"]
            : ["id", "name", "state", "status", "created_at"],
      });

      setEntities(response.data || []);
    } catch (_) {
      setEntities([]);
    } finally {
      setEntitiesLoading(false);
    }
  }, [batchOperation.entity_type, entityIds, ikApi]);

  useEffect(() => {
    setEntityIds(batchOperation.entity_ids || []);
  }, [batchOperation.entity_ids]);

  useEffect(() => {
    loadEntities();
  }, [entityIds, loadEntities]);

  useEffect(() => {
    setKey(storageKey, paginationModel);
  }, [paginationModel, setKey, storageKey]);

  const handleRefresh = () => {
    loadEntities();
  };

  const handleOpenLogs = (entityId: string) => {
    setLogsEntityId(entityId);
  };

  const handleCloseLogs = () => {
    setLogsEntityId(null);
  };

  const handleOpenAddDialog = () => {
    addForm.reset({
      name: "",
      description: "",
      entity_type: batchOperation.entity_type,
      entity_ids: [],
    });
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
  };

  const handleOpenActionDialog = (type: "dryrun" | "execute") => {
    setActionType(type);
    setActionResults({});
    setActionDialogOpen(true);
  };

  const handleCloseActionDialog = () => {
    if (actionRunning) return;
    setActionDialogOpen(false);
  };

  const handleRunAction = useCallback(async () => {
    if (!actionType) return;

    const ids = selectedEntityIds.map(String);
    if (ids.length === 0) return;

    const entityName =
      batchOperation.entity_type === "resource" ? "resources" : "executors";

    setActionRunning(true);
    setActionResults(
      ids.reduce(
        (acc, id) => ({
          ...acc,
          [id]: { status: "pending" },
        }),
        {},
      ),
    );

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          await ikApi.patchRaw(`${entityName}/${id}/actions`, {
            action: actionType,
          });
          return { id, status: "success" as const };
        } catch (error: any) {
          return {
            id,
            status: "error" as const,
            message: error?.message || "Failed",
          };
        }
      }),
    );

    setActionResults((prev) => {
      const next = { ...prev };
      results.forEach((result) => {
        next[result.id] = {
          status: result.status,
          message: result.message,
        };
      });
      return next;
    });

    const successCount = results.filter(
      (result) => result.status === "success",
    ).length;
    const errorCount = results.length - successCount;
    notify(
      `${actionType === "dryrun" ? "Plan" : "Execute"} completed: ${successCount} success, ${errorCount} failed`,
      errorCount ? "warning" : "success",
    );

    setActionRunning(false);
  }, [actionType, batchOperation.entity_type, ikApi, selectedEntityIds]);

  const handleRemoveEntity = useCallback(
    async (entityId: string) => {
      if (!batchOperation?.id) return;
      try {
        setEntitiesLoading(true);
        const response = await ikApi.patchRaw(
          `batch_operations/${batchOperation.id}/entity_ids`,
          {
            action: "remove",
            entity_ids: [entityId],
          },
        );
        if (response?.id) {
          notify("Entity removed from batch operation", "success");
          setEntityIds(response.entity_ids || []);
        }
      } catch (error) {
        notifyError(error);
      } finally {
        setEntitiesLoading(false);
      }
    },
    [batchOperation?.id, ikApi, setEntityIds],
  );

  const handleAddEntities = useCallback(
    async (values: BatchOperationCreate) => {
      if (!batchOperation?.id) return;
      if (!values.entity_ids || values.entity_ids.length === 0) return;

      try {
        setEntitiesLoading(true);
        const response = await ikApi.patchRaw(
          `batch_operations/${batchOperation.id}/entity_ids`,
          {
            action: "add",
            entity_ids: values.entity_ids,
          },
        );
        if (response?.id) {
          notify("Entities added to batch operation", "success");
          setAddDialogOpen(false);
          setEntityIds(response.entity_ids || []);
        }
      } catch (error) {
        notifyError(error);
      } finally {
        setEntitiesLoading(false);
      }
    },
    [batchOperation?.id, ikApi, setEntityIds],
  );

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
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams) => (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleRemoveEntity(params.row.id)}
          >
            Delete
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
  }, [batchOperation?.entity_type, handleRemoveEntity]);

  return (
    <PropertyCard
      title={`${batchOperation?.entity_type === "resource" ? "Resources" : "Executors"} in Batch`}
      actions={
        <>
          <Button
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            variant="outlined"
            size="small"
          >
            Add
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenActionDialog("dryrun")}
            disabled={selectedEntityIds.length === 0}
          >
            Plan
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleOpenActionDialog("execute")}
            disabled={selectedEntityIds.length === 0}
          >
            Execute
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </>
      }
    >
      <DataGrid
        rows={entities}
        columns={entityColumns}
        autoHeight
        loading={entitiesLoading}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={{
          type: "include",
          ids: new Set(selectedEntityIds),
        }}
        onRowSelectionModelChange={(newSelection: GridRowSelectionModel) => {
          const currentPageIds = entities.map((entity) => String(entity.id));
          const excludedIds = new Set(Array.from(newSelection.ids).map(String));

          const nextSelected =
            newSelection.type === "exclude"
              ? currentPageIds.filter((id) => !excludedIds.has(id))
              : Array.from(excludedIds);

          setSelectedEntityIds(nextSelected);
        }}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
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
        <DialogActions>
          <Button onClick={handleCloseLogs} color="primary" variant="outlined">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        fullWidth
        maxWidth="xl"
      >
        <DialogTitle>
          {`Add ${batchOperation?.entity_type === "resource" ? "Resources" : "Executors"}`}
        </DialogTitle>
        <FormProvider {...addForm}>
          <DialogContent>
            <BatchOperationEntitySelector
              control={addForm.control}
              errors={addForm.formState.errors}
              entityType={batchOperation.entity_type}
              setValue={addForm.setValue}
            />
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={handleCloseAddDialog}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={addForm.handleSubmit(handleAddEntities)}
            >
              Add Selected
            </Button>
          </DialogActions>
        </FormProvider>
      </Dialog>
      <Dialog
        open={actionDialogOpen}
        onClose={handleCloseActionDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {actionType === "dryrun" ? "Plan Selected" : "Execute Selected"}
          {selectedEntityIds.length > 0 ? ` (${selectedEntityIds.length})` : ""}
        </DialogTitle>
        <DialogContent>
          {selectedEntityIds.length === 0 ? (
            <p>No entities selected.</p>
          ) : (
            <List dense disablePadding>
              {selectedEntityIds.map((id) => {
                const key = String(id);
                const result = actionResults[key];
                const entity = entities.find((item) => String(item.id) === key);
                const status = result ? result.status : "pending";
                const statusColor =
                  status === "success"
                    ? "success"
                    : status === "error"
                      ? "error"
                      : "default";

                return (
                  <ListItem key={key} disableGutters>
                    <ListItemText
                      primary={entity ? <GetEntityLink {...entity} /> : key}
                      secondary={result?.message}
                    />
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={status}
                        color={statusColor}
                        variant={status === "pending" ? "outlined" : "filled"}
                      />
                    </Stack>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleCloseActionDialog}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleRunAction}
            disabled={selectedEntityIds.length === 0 || actionRunning}
          >
            {actionType === "dryrun" ? "Run Plan" : "Run Execute"}
          </Button>
        </DialogActions>
      </Dialog>
    </PropertyCard>
  );
};
