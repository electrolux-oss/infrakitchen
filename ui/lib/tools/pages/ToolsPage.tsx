import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import { Button, Typography } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { CommonDialog } from "../../common/components/dialogs";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import { useEventProvider, usePermissionProvider } from "../../common/context";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  ToolDownloadDialog,
  ToolDownloadInput,
} from "../components/ToolDownloadDialog";
import {
  TOOL_PENDING_STATUSES,
  toolColumns,
} from "../components/toolTableConfig";
import {
  TOOL_ACTION_MUTATION,
  TOOL_FIELD_MAP,
  DEFAULT_TOOL_QUERY,
  DELETE_TOOL_MUTATION,
  DOWNLOAD_TOOL_MUTATION,
  SET_DEFAULT_TOOL_MUTATION,
} from "../graphql";
import {
  Tool,
  ToolShort,
  toolLabel,
  toolStatus,
  defaultToolLabel,
} from "../types";

const POLL_INTERVAL_MS = 3000;

export const ToolsPage = () => {
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();
  const { event } = useEventProvider();
  const { permissions } = usePermissionProvider();
  // tools are visible to everyone, only super admins can manage them
  const canManage = permissions["*"] === "admin";
  const liveUpdates = !!webSocketEnabled && !!globalConfig?.websocket;

  const tableRef = useRef<EntityFetchTableRef>(null);

  const [defaultTool, setDefaultTool] = useState<ToolShort | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [clearDefaultDialogOpen, setClearDefaultDialogOpen] = useState(false);
  const [deleteDialogTool, setDeleteDialogTool] = useState<Tool | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDefaultTool = useCallback(async () => {
    try {
      const response = await ikApi.graphqlRequest<{ tools: ToolShort[] }>(
        DEFAULT_TOOL_QUERY,
      );
      setDefaultTool(response.tools[0] ?? null);
    } catch (error: any) {
      notifyError(error);
    }
  }, [ikApi]);

  const refresh = useCallback(async () => {
    await Promise.all([tableRef.current?.refresh(), fetchDefaultTool()]);
  }, [fetchDefaultTool]);

  useEffect(() => {
    fetchDefaultTool();
  }, [fetchDefaultTool]);

  // events are published after the change is committed, so refetching shows the current state
  useEffect(() => {
    if (event?._entity_name === "tool") {
      refresh();
    }
  }, [event, refresh]);

  // fallback when websocket events are not available
  useEffect(() => {
    if (!hasPending || liveUpdates) {
      return;
    }
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, liveUpdates, refresh]);

  const handleDataChange = useCallback((rows: Tool[]) => {
    setHasPending(
      rows.some((row) => TOOL_PENDING_STATUSES.includes(toolStatus(row))),
    );
  }, []);

  const requestDownload = useCallback(
    async (input: ToolDownloadInput): Promise<boolean> => {
      try {
        setDownloading(true);
        await ikApi.graphqlRequest(DOWNLOAD_TOOL_MUTATION, { input });
        notify(`Downloading ${input.name} ${input.version}`, "info");
        await refresh();
        return true;
      } catch (error: any) {
        notifyError(error);
        return false;
      } finally {
        setDownloading(false);
      }
    },
    [ikApi, refresh],
  );

  const handleSetDefault = useCallback(
    async (tool: Tool | null) => {
      try {
        setSettingDefault(true);
        await ikApi.graphqlRequest(SET_DEFAULT_TOOL_MUTATION, {
          id: tool?.id ?? null,
        });
        notify(
          tool
            ? `${tool.name} ${tool.version} is the global default`
            : "Global default cleared",
          "success",
        );
        await refresh();
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSettingDefault(false);
      }
    },
    [ikApi, refresh],
  );

  const handleDelete = async () => {
    if (!deleteDialogTool) {
      return;
    }
    try {
      setDeleting(true);
      await ikApi.graphqlRequest(DELETE_TOOL_MUTATION, {
        id: deleteDialogTool.id,
      });
      notify("Tool deleted", "success");
      setDeleteDialogTool(null);
      await refresh();
    } catch (error: any) {
      notifyError(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = useCallback(
    async (tool: Tool, action: "disable" | "enable") => {
      try {
        await ikApi.graphqlRequest(TOOL_ACTION_MUTATION, {
          id: tool.id,
          input: { action },
        });
        notify(
          `${toolLabel(tool)} is ${action === "disable" ? "disabled" : "enabled"}`,
          "success",
        );
        await refresh();
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, refresh],
  );

  // row actions go through refs so the columns (and the table filters) stay stable
  const actionsRef = useRef({
    onRetry: requestDownload,
    onSetDefault: handleSetDefault,
    onAction: handleAction,
  });
  actionsRef.current = {
    onRetry: requestDownload,
    onSetDefault: handleSetDefault,
    onAction: handleAction,
  };

  const columns = useMemo(
    () =>
      toolColumns({
        onRetry: (tool) =>
          actionsRef.current.onRetry({
            name: tool.name,
            version: tool.version,
            os: tool.os,
            arch: tool.arch,
          }),
        onSetDefault: (tool) => actionsRef.current.onSetDefault(tool),
        onAction: (tool, action) => actionsRef.current.onAction(tool, action),
        onDelete: (tool) => setDeleteDialogTool(tool),
      }).filter((column) => canManage || column.field !== "actions"),
    [canManage],
  );

  return (
    <PageContainer
      title="IaC Tools"
      description={`${defaultToolLabel(defaultTool)}. Used by resources and executors without a selected tool.`}
      actions={
        <PermissionWrapper requiredPermission="*" permissionAction="admin">
          {defaultTool && (
            <Button
              variant="outlined"
              onClick={() => setClearDefaultDialogOpen(true)}
              disabled={settingDefault}
            >
              Clear default
            </Button>
          )}
          <Button
            startIcon={<AddIcon />}
            onClick={() => setDownloadDialogOpen(true)}
          >
            Add tool
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        ref={tableRef}
        title="Tools"
        entityName="tool"
        columns={columns}
        entityFieldMap={TOOL_FIELD_MAP}
        defaultSort={{ field: "created_at", sort: "desc" }}
        onDataChange={handleDataChange}
        syncFiltersToUrl
      />

      <ToolDownloadDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        onDownload={requestDownload}
        downloading={downloading}
      />

      <CommonDialog
        open={clearDefaultDialogOpen}
        onClose={() => setClearDefaultDialogOpen(false)}
        title="Clear global default?"
        content={
          <Typography variant="body2">
            {defaultTool &&
              `${toolLabel(defaultTool)} will no longer be the global default. Resources and executors without a selected tool will run the tofu installed on the worker.`}
          </Typography>
        }
        actions={
          <Button
            color="warning"
            variant="contained"
            onClick={async () => {
              await handleSetDefault(null);
              setClearDefaultDialogOpen(false);
            }}
            disabled={settingDefault}
          >
            Clear default
          </Button>
        }
      />

      <CommonDialog
        open={deleteDialogTool !== null}
        onClose={() => setDeleteDialogTool(null)}
        title="Delete tool?"
        content={
          <Typography variant="body2">
            {deleteDialogTool &&
              `Delete ${deleteDialogTool.name} ${deleteDialogTool.version}? Tools used by resources or executors cannot be deleted.`}
          </Typography>
        }
        actions={
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            Delete
          </Button>
        }
      />
    </PageContainer>
  );
};

ToolsPage.path = "/tools";
