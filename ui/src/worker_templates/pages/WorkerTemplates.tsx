import { useMemo } from "react";

import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import type { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import { getProviderValue } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import PageContainer from "../../common/PageContainer";
import { HeroExclamationTriangleIcon, HeroPlusCircleIcon } from "../../icons";
import { Button, RenderCellParams, Tooltip } from "../../ui";
import { WORKER_TEMPLATE_FIELD_MAP } from "../graphql";

export const WorkerTemplatesPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const columns = useMemo<EntityTableColumn[]>(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "entityName", "lastError"],
        flex: 1,
        hideable: false,
        renderCell: (params: RenderCellParams) => (
          <div className="flex items-center gap-2">
            <Entity entity={params.row} />
            {params.row.lastError && (
              <Tooltip title={params.row.lastError}>
                <span className="inline-flex text-warning">
                  <HeroExclamationTriangleIcon className="size-4" />
                </span>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        field: "description",
        headerName: "Description",
        flex: 1,
      },
      {
        field: "provider",
        headerName: "Provider",
        flex: 0.7,
        renderCell: (params: RenderCellParams) =>
          getProviderValue(params.value, 18),
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.6,
        renderCell: (params: RenderCellParams) => (
          <StatusLabel status={String(params.row.status).toLowerCase()} />
        ),
      },
      {
        field: "maxWorkers",
        headerName: "Max workers",
        flex: 0.5,
        sortField: "max_workers",
      },
      {
        field: "priority",
        headerName: "Priority",
        flex: 0.5,
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        align: "right",
        headerAlign: "right",
        sortField: "created_at",
        renderCell: (params: RenderCellParams) => (
          <RelativeTime date={params.value} compact />
        ),
      },
      userColumn({ disableFilter: true }),
    ],
    [],
  );

  return (
    <PageContainer
      title="Worker Templates"
      description="Spawn task workers on demand when tasks are waiting, and remove them once they are idle."
      actions={
        <PermissionWrapper
          requiredPermission="api:worker_template"
          permissionAction="admin"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}worker_templates/create`)}
            startIcon={<HeroPlusCircleIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Worker Templates"
        entityName="workerTemplate"
        columns={columns}
        entityFieldMap={WORKER_TEMPLATE_FIELD_MAP}
        defaultSort={{ field: "priority", sort: "desc" }}
      />
    </PageContainer>
  );
};

WorkerTemplatesPage.path = "/worker_templates";
