import { useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import PageContainer from "../../common/PageContainer";
import { PermissionWrapper } from "../../common/wrappers/PermissionWrapper";
import { HeroDocumentTextIcon, HeroPlusCircleIcon } from "../../icons";
import { TaskQueueButton } from "../../tasks/components/TaskQueueDialog";
import { Button, IconButton, Tooltip } from "../../ui";
import { RenderCellParams } from "../../ui";
import { WorkerLogsDialog } from "../../worker_templates/components/WorkerLogsDialog";
import { WORKER_LOGS_QUERY } from "../../worker_templates/graphql";
import { WORKER_FIELD_MAP } from "../graphql";

// Helper function to flatten nested objects,
// same as the one in the original code.
const flattenObject = (object: any) => {
  const result: Record<string, object> = {};
  for (const i in object) {
    if (typeof object[i] === "object" && object[i] !== null) {
      const flatObj = flattenObject(object[i]);
      for (const x in flatObj) {
        if (x) {
          result[`${i}_${x}`] = flatObj[x];
        }
      }
    } else {
      result[i] = object[i];
    }
  }
  return result;
};

const HostInfoField = {
  field: "hostMetadata",
  sortable: false,
  headerName: "Host info",
  flex: 2,
  renderCell: (params: RenderCellParams) => {
    if (!params.value) {
      return null;
    }

    const metadata = flattenObject(params.value);

    const formattedString = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    const platform = metadata.platform || "N/A";
    const arch = metadata.machine || "N/A";

    const condensedDisplay = `${platform} (${arch})`;

    return (
      <Tooltip
        title={
          <span className="max-w-105 font-mono text-caption [word-break:break-word] whitespace-pre-wrap">
            {formattedString}
          </span>
        }
        placement="top-start"
      >
        <p className="m-0 text-body2">{condensedDisplay}</p>
      </Tooltip>
    );
  },
};

export default function WorkerList() {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [logsWorker, setLogsWorker] = useState<{
    id: string;
    host: string;
  } | null>(null);
  const columns = useMemo(
    () => [
      {
        field: "host",
        headerName: "Host",
        flex: 1,
        hideable: false,
      },
      {
        // On-demand workers are named after the worker template they were spawned from
        field: "name",
        headerName: "Name",
        flex: 1,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        renderCell: (params: RenderCellParams) => (
          <StatusLabel status={String(params.row.status).toLowerCase()} />
        ),
      },
      {
        field: "currentTask",
        headerName: "Last Task",
        flex: 2,
        sortable: false,
        renderCell: (params: RenderCellParams) => {
          if (!params.value) {
            return <p className="m-0 text-body2 text-fg-muted">N/A</p>;
          }
          // current_task is a free-form JSON blob stored with snake_case keys.
          const { entity, entity_id, action, user, started_at } = params.value;
          const label = `${entity} / ${action}`;
          return (
            <Tooltip
              title={
                <span className="max-w-105 font-mono text-caption [word-break:break-word] whitespace-pre-wrap">
                  {`Entity: ${entity}\nID: ${entity_id}\nAction: ${action}\nUser: ${user}\nStarted: ${started_at}`}
                </span>
              }
              placement="top-start"
            >
              <Entity
                entity={{ id: entity_id, entityType: entity, name: label }}
              />
            </Tooltip>
          );
        },
      },
      {
        field: "tasksCompleted",
        headerName: "Completed",
        flex: 0.5,
        sortField: "tasks_completed",
        renderCell: (params: RenderCellParams) => (
          <p className="m-0 text-body2">{params.value ?? 0}</p>
        ),
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        sortField: "created_at",
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        sortField: "updated_at",
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      HostInfoField,
      {
        field: "logs",
        headerName: "",
        width: 60,
        sortable: false,
        hideable: false,
        fetchFields: ["id", "host", "hostMetadata"],
        // Only workers spawned from a worker template have logs to read
        renderCell: (params: RenderCellParams) =>
          params.row.hostMetadata?.worker_template_id ? (
            <PermissionWrapper
              requiredPermission="api:worker_template"
              permissionAction="read"
            >
              <Tooltip title="Logs">
                <IconButton
                  onClick={() =>
                    setLogsWorker({ id: params.row.id, host: params.row.host })
                  }
                >
                  <HeroDocumentTextIcon className="size-5" />
                </IconButton>
              </Tooltip>
            </PermissionWrapper>
          ) : null,
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Workers"
      icon={entityIcons.worker}
      description="The processes that pick up and execute infrastructure tasks."
      actions={
        <div className="flex items-center gap-2">
          {/* The queue is task data, so it needs task read access on top of worker access */}
          <PermissionWrapper
            requiredPermission="api:task"
            permissionAction="read"
          >
            <TaskQueueButton />
          </PermissionWrapper>
          {/* Workers are not created directly: on-demand ones are spawned from worker templates */}
          <PermissionWrapper
            requiredPermission="api:worker_template"
            permissionAction="admin"
          >
            <Button
              onClick={() => navigate(`${linkPrefix}worker_templates/create`)}
              startIcon={<HeroPlusCircleIcon />}
            >
              Create Worker Template
            </Button>
          </PermissionWrapper>
        </div>
      }
    >
      <EntityFetchTable
        title="Workers"
        entityName="worker"
        columns={columns}
        entityFieldMap={WORKER_FIELD_MAP}
      />
      <WorkerLogsDialog
        title={logsWorker?.host ?? null}
        query={WORKER_LOGS_QUERY}
        variables={{ id: logsWorker?.id }}
        resultKey="workerLogs"
        onClose={() => setLogsWorker(null)}
      />
    </PageContainer>
  );
}
