import { useCallback, useEffect, useMemo, useState } from "react";

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

import { buildAuditLogsQuery, GqlAuditLog } from "../../audit_logs/graphql";
import { useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCard } from "../../common/components/PropertyCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useLocalStorage } from "../../common/context/UIStateContext";
import { buildGraphqlFields } from "../../common/graphql/buildGraphqlFields";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { LogActionButtons } from "../../common/LogsComponent/LogActionButtons";
import { Logs } from "../../common/LogsComponent/Logs";
import StatusChip from "../../common/StatusChip";
import { EXECUTOR_FIELD_MAP } from "../../executors/graphql";
import { RESOURCE_FIELD_MAP } from "../../resources/graphql";
import { BATCH_OPERATION_ENTITY_IDS_MUTATION } from "../graphql";
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
    batchOperation.entityIds || [],
  );
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [logsEntityId, setLogsEntityId] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [logView, setLogView] = useState<"summary" | "logs">("logs");
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
      entityType: batchOperation.entityType,
      entityIds: [],
    },
  });

  const loadEntities = useCallback(async () => {
    if (!entityIds || entityIds.length === 0) {
      setEntities([]);
      return;
    }

    setEntitiesLoading(true);
    try {
      const isResource = batchOperation.entityType === "resource";
      const entityName = isResource ? "resource" : "executor";
      const fields = isResource
        ? [
            "id",
            "name",
            "state",
            "status",
            "created_at",
            "updated_at",
            "template",
          ]
        : ["id", "name", "state", "status", "created_at", "updated_at"];
      const fieldMap = isResource ? RESOURCE_FIELD_MAP : EXECUTOR_FIELD_MAP;

      const query = `
        query BatchEntities($filter: JSON, $sort: [String!], $range: [Int!]) {
          ${entityName}s(filter: $filter, sort: $sort, range: $range) {
            ${buildGraphqlFields(fields, fieldMap)}
          }
        }
      `;

      const response = await ikApi.graphqlRequest<Record<string, any>>(query, {
        filter: { id__in: entityIds },
        sort: ["name", "ASC"],
        range: [0, 1000],
      });

      const rawList: any[] = response[`${entityName}s`] || [];
      const mapped = rawList.map((item: any) => ({
        id: item.id,
        name: item.name,
        state: item.state,
        status: item.status,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        _entity_name: entityName,
        ...(isResource && item.template
          ? { template: { ...item.template, _entity_name: "template" } }
          : {}),
      }));

      setEntities(mapped);
    } catch (_) {
      setEntities([]);
    } finally {
      setEntitiesLoading(false);
    }
  }, [batchOperation.entityType, entityIds, ikApi]);

  useEffect(() => {
    setEntityIds(batchOperation.entityIds || []);
  }, [batchOperation.entityIds]);

  useEffect(() => {
    loadEntities();
  }, [entityIds, loadEntities]);

  useEffect(() => {
    setKey(storageKey, paginationModel);
  }, [paginationModel, setKey, storageKey]);

  const handleRefresh = () => {
    loadEntities();
  };

  const fetchLastAuditLog = useCallback(
    async (entity_id: string) => {
      await ikApi
        .graphqlRequest<{ auditLogs: GqlAuditLog[] }>(
          buildAuditLogsQuery(["id"]),
          {
            filter: { entity_id, model: batchOperation.entityType },
            sort: ["created_at", "DESC"],
            range: [0, 1],
          },
        )
        .then((response) => {
          const lastLog = response.auditLogs?.[0];
          setAuditId(lastLog?.id || null);
          setLogsEntityId(entity_id);
        })
        .catch(() => {
          setAuditId(null);
        });
    },
    [ikApi, batchOperation.entityType],
  );

  const handleOpenLogs = useCallback(
    (entityId: string, view: string) => {
      setLogView(view as "summary" | "logs");
      fetchLastAuditLog(entityId);
    },
    [fetchLastAuditLog],
  );

  const handleCloseLogs = () => {
    setLogsEntityId(null);
  };

  const handleOpenAddDialog = () => {
    addForm.reset({
      name: "",
      description: "",
      entityType: batchOperation.entityType,
      entityIds: [],
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
      batchOperation.entityType === "resource" ? "resources" : "executors";

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
  }, [actionType, batchOperation.entityType, ikApi, selectedEntityIds]);

  const handleRemoveEntity = useCallback(
    async (entityId: string) => {
      if (!batchOperation?.id) return;
      try {
        setEntitiesLoading(true);
        const response = await ikApi.graphqlRequest<{
          batchOperationEntityIds: { id: string; entityIds: string[] };
        }>(BATCH_OPERATION_ENTITY_IDS_MUTATION, {
          id: batchOperation.id,
          input: {
            action: "remove",
            entityIds: [entityId],
          },
        });
        const updated = response.batchOperationEntityIds;
        if (updated?.id) {
          notify("Entity removed from batch operation", "success");
          setEntityIds(updated.entityIds || []);
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
      if (!values.entityIds || values.entityIds.length === 0) return;

      try {
        setEntitiesLoading(true);
        const response = await ikApi.graphqlRequest<{
          batchOperationEntityIds: { id: string; entityIds: string[] };
        }>(BATCH_OPERATION_ENTITY_IDS_MUTATION, {
          id: batchOperation.id,
          input: {
            action: "add",
            entityIds: values.entityIds,
          },
        });
        const updated = response.batchOperationEntityIds;
        if (updated?.id) {
          notify("Entities added to batch operation", "success");
          setAddDialogOpen(false);
          setEntityIds(updated.entityIds || []);
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
        field: "updated_at",
        headerName: "Last Updated",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              height: "100%",
            }}
          />
        ),
      },
      {
        field: "logs",
        headerName: "Logs",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams) => (
          <LogActionButtons
            action={"any"}
            sourceCodeLanguage={"opentofu"}
            onOpenSummary={() => handleOpenLogs(params.row.id, "summary")}
            onOpenLogs={() => handleOpenLogs(params.row.id, "logs")}
          />
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
    if (batchOperation?.entityType === "resource") {
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
  }, [batchOperation?.entityType, handleRemoveEntity, handleOpenLogs]);

  return (
    <PropertyCard
      title={`${batchOperation?.entityType === "resource" ? "Resources" : "Executors"} in Batch`}
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
          {logsEntityId && auditId && (
            <Logs entityId={logsEntityId} auditLogId={auditId} view={logView} />
          )}
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
          {`Add ${batchOperation?.entityType === "resource" ? "Resources" : "Executors"}`}
        </DialogTitle>
        <FormProvider {...addForm}>
          <DialogContent>
            <BatchOperationEntitySelector
              control={addForm.control}
              errors={addForm.formState.errors}
              entityType={batchOperation.entityType}
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
