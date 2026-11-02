import { useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { Audit } from "../../common/components/activity/Audit";
import { DeleteButton } from "../../common/components/buttons/DeleteEntityButton";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { CountLabel } from "../../common/components/labels";
import { useEventProvider } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { EntityExecutors } from "../../executors/components/EntityExecutors";
import { EntityResources } from "../../resources/components/EntityResources";
import { Button } from "../../ui";
import {
  GqlWorkerTemplateDetail,
  SET_DEFAULT_WORKER_TEMPLATE_MUTATION,
} from "../graphql";

import { WorkerTemplateConfiguration } from "./WorkerTemplateConfiguration";
import { WorkerTemplateInstances } from "./WorkerTemplateInstances";
import { WorkerTemplateSidebar } from "./WorkerTemplateSidebar";

const UNROUTED_TASKS =
  "Resources and executors without a selected template, and all other tasks, will run on static workers.";

export const WorkerTemplateContent = () => {
  const { ikApi, linkPrefix } = useConfig();
  const { entity, refreshEntity, refreshActions } = useEntityProvider();
  const { event } = useEventProvider();
  const navigate = useNavigate();
  const workerTemplate = entity as GqlWorkerTemplateDetail | undefined;

  const fixedFilters = useMemo(
    () => ({ worker_template_id: workerTemplate?.id }),
    [workerTemplate?.id],
  );

  // the entity itself is updated from the event by the provider, the actions depend on it
  useEffect(() => {
    if (workerTemplate?.id && event?.id === workerTemplate.id) {
      refreshActions?.();
    }
  }, [event, workerTemplate?.id, refreshActions]);

  if (!workerTemplate) return null;

  const clearDefault = async () => {
    try {
      await ikApi.graphqlRequest(SET_DEFAULT_WORKER_TEMPLATE_MUTATION, {
        id: null,
      });
      notify("Global default cleared", "success");
      refreshEntity?.();
      refreshActions?.();
    } catch (error: any) {
      notifyError(error);
    }
  };

  const tabs: TabDefinition[] = [
    {
      label: "Instances",
      content: <WorkerTemplateInstances workerTemplateId={workerTemplate.id} />,
    },
    {
      label: "Configuration",
      content: <WorkerTemplateConfiguration workerTemplate={workerTemplate} />,
    },
    {
      label: "Resources",
      tabLabel: (
        <CountLabel
          label="Resources"
          count={workerTemplate.resourcesCount ?? 0}
        />
      ),
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_worker_template_resources"
        />
      ),
    },
    {
      label: "Executors",
      tabLabel: (
        <CountLabel
          label="Executors"
          count={workerTemplate.executorsCount ?? 0}
        />
      ),
      content: (
        <EntityExecutors
          fixedFilters={fixedFilters}
          filterStorageKey="filter_worker_template_executors"
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={workerTemplate.id} />,
    },
    {
      label: "Settings",
      requiredPermission: "api:worker_template",
      permissionAction: "admin" as const,
      content: (
        <DangerZoneCard
          dangerZoneActions={[
            {
              key: "clear_default",
              label: "Clear default",
              severity: "warning",
              description: `${UNROUTED_TASKS} A default can be set again at any time.`,
              helperText: `${workerTemplate.name} will no longer be the global default. ${UNROUTED_TASKS}`,
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
                "No new workers are spawned and running ones stop taking tasks. Tasks of resources and executors selecting it run on the global default's workers. It can be enabled again at any time.",
              helperText: `Are you sure you want to disable ${workerTemplate.name}? It can be enabled again at any time.`,
            },
            {
              key: "delete",
              label: "Delete",
              severity: "destructive",
              description:
                "Permanently removes this worker template. Templates selected by resources or executors, or with running workers, cannot be deleted.",
              helperText: `Are you sure you want to delete ${workerTemplate.name}? This cannot be undone.`,
              renderDialogActions: (close) => (
                <DeleteButton
                  onClose={close}
                  onDelete={() => navigate(`${linkPrefix}worker_templates`)}
                  ikApi={ikApi}
                  entity_name="worker_template"
                  entity_id={workerTemplate.id}
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
    <EntitySidebarLayout
      sidebar={<WorkerTemplateSidebar workerTemplate={workerTemplate} />}
    >
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
