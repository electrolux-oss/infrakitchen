import { useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Box, Button } from "@mui/material";

import { useConfig } from "../../common";
import { Audit } from "../../common/components/activity/Audit";
import { EntityLogs } from "../../common/components/activity/EntityLogs";
import { DeleteButton } from "../../common/components/buttons/DeleteEntityButton";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import {
  TabbedContent,
  TabCountLabel,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEventProvider } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { EntityExecutors } from "../../executors/components/EntityExecutors";
import { EntityResources } from "../../resources/components/EntityResources";
import { SET_DEFAULT_TOOL_MUTATION } from "../graphql";
import { ToolDetail, toolLabel } from "../types";

import { ToolOverview } from "./ToolOverview";

export const ToolContent = () => {
  const { ikApi, linkPrefix } = useConfig();
  const { entity, refreshEntity, refreshActions } = useEntityProvider();
  const { event } = useEventProvider();
  const navigate = useNavigate();
  const tool = entity as ToolDetail | undefined;

  const fixedFilters = useMemo(() => ({ tool_id: tool?.id }), [tool?.id]);

  // the entity itself is updated from the event by the provider, the actions depend on it
  useEffect(() => {
    if (tool?.id && event?.id === tool.id) {
      refreshActions?.();
    }
  }, [event, tool?.id, refreshActions]);

  if (!tool) return null;

  const clearDefault = async () => {
    try {
      await ikApi.graphqlRequest(SET_DEFAULT_TOOL_MUTATION, { id: null });
      notify("Global default cleared", "success");
      refreshEntity?.();
      refreshActions?.();
    } catch (error: any) {
      notifyError(error);
    }
  };

  const tabs: TabDefinition[] = [
    {
      label: "Resources",
      tabLabel: (
        <TabCountLabel label="Resources" count={tool.resourcesCount ?? 0} />
      ),
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_tool_resources"
        />
      ),
    },
    {
      label: "Executors",
      tabLabel: (
        <TabCountLabel label="Executors" count={tool.executorsCount ?? 0} />
      ),
      content: (
        <EntityExecutors
          fixedFilters={fixedFilters}
          filterStorageKey="filter_tool_executors"
        />
      ),
    },
    {
      label: "Logs",
      content: <EntityLogs entityId={tool.id} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={tool.id} />,
    },
    {
      label: "Settings",
      requiredPermission: "*",
      permissionAction: "admin",
      content: (
        <DangerZoneCard
          dangerZoneActions={[
            {
              key: "clear_default",
              label: "Clear default",
              severity: "warning",
              description:
                "Resources and executors without a selected tool will run the tofu installed on the worker. A default can be set again at any time.",
              helperText: `${toolLabel(tool)} will no longer be the global default. Resources and executors without a selected tool will run the tofu installed on the worker.`,
              renderDialogActions: (close) => (
                <Button
                  color="warning"
                  variant="contained"
                  onClick={async () => {
                    await clearDefault();
                    close();
                  }}
                >
                  Clear default
                </Button>
              ),
              refreshAfterConfirm: false,
            },
            {
              key: "disable",
              label: "Disable",
              severity: "warning",
              description:
                "The tool can't be selected by resources and executors anymore, the ones already using it keep working. It can be enabled again at any time.",
              helperText: `Are you sure you want to disable ${toolLabel(tool)}? It can be enabled again at any time.`,
            },
            {
              key: "delete",
              label: "Delete",
              severity: "destructive",
              description:
                "Permanently removes this tool. Tools used by resources or executors cannot be deleted.",
              helperText: `Are you sure you want to delete ${toolLabel(tool)}? This cannot be undone.`,
              renderDialogActions: (close) => (
                <DeleteButton
                  onClose={close}
                  onDelete={() => navigate(`${linkPrefix}tools`)}
                  ikApi={ikApi}
                  entity_name="tool"
                  entity_id={tool.id}
                >
                  Delete
                </DeleteButton>
              ),
              refreshAfterConfirm: false,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <ToolOverview tool={tool} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
