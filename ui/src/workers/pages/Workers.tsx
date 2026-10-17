import { useMemo } from "react";

import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { PermissionWrapper } from "../../common/wrappers/PermissionWrapper";
import { TaskQueueButton } from "../../tasks/components/TaskQueueDialog";
import { Tooltip } from "../../ui";
import { RenderCellParams } from "../../ui";
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
  const columns = useMemo(
    () => [
      {
        field: "host",
        headerName: "Host",
        flex: 1,
        hideable: false,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        renderCell: (params: RenderCellParams) => (
          <StatusChip status={String(params.row.status).toLowerCase()} />
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
    ],
    [],
  );

  return (
    <PageContainer
      title="Workers"
      description="The processes that pick up and execute infrastructure tasks."
      actions={
        // The queue is task data, so it needs task read access on top of worker access
        <PermissionWrapper
          requiredPermission="api:task"
          permissionAction="read"
        >
          <TaskQueueButton />
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Workers"
        entityName="worker"
        columns={columns}
        entityFieldMap={WORKER_FIELD_MAP}
      />
    </PageContainer>
  );
}
