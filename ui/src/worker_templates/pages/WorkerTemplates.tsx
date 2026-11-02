import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import {
  EntityFetchTable,
  type EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import type { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import { getProviderValue } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Label, StatusLabel } from "../../common/components/labels";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  HeroExclamationTriangleIcon,
  HeroPlusCircleIcon,
  HeroServerStackIcon,
} from "../../icons";
import { Button, RenderCellParams, Tooltip } from "../../ui";
import { DefaultWorkerTemplateSelect } from "../components";
import {
  GqlWorkerTemplateShort,
  WORKER_TEMPLATE_FIELD_MAP,
  WORKER_TEMPLATE_OPTIONS_QUERY,
} from "../graphql";

export const WorkerTemplatesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const tableRef = useRef<EntityFetchTableRef>(null);
  const [templates, setTemplates] = useState<GqlWorkerTemplateShort[]>([]);
  const defaultTemplate = templates.find((t) => t.isDefault) ?? null;

  const loadTemplates = useCallback(() => {
    ikApi
      .graphqlRequest<{ workerTemplateOptions: GqlWorkerTemplateShort[] }>(
        WORKER_TEMPLATE_OPTIONS_QUERY,
      )
      .then((response) => setTemplates(response.workerTemplateOptions))
      .catch(notifyError);
  }, [ikApi]);

  useEffect(loadTemplates, [loadTemplates]);

  const onDefaultChanged = useCallback(() => {
    loadTemplates();
    void tableRef.current?.refresh();
  }, [loadTemplates]);

  const columns = useMemo<EntityTableColumn[]>(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "entityName", "lastError", "isDefault"],
        flex: 1,
        hideable: false,
        renderCell: (params: RenderCellParams) => (
          <div className="flex items-center gap-2">
            <Entity entity={params.row} />
            {params.row.isDefault && <Label tone="primary" label="default" />}
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
      // the current global default is shown by the picker in the actions
      description="Spawn task workers on demand when tasks are waiting, and remove them once they are idle."
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PermissionWrapper
            requiredPermission="api:worker_template"
            permissionAction="admin"
          >
            <DefaultWorkerTemplateSelect
              templates={templates}
              defaultTemplate={defaultTemplate}
              onChanged={onDefaultChanged}
            />
          </PermissionWrapper>
          <PermissionWrapper
            requiredPermission="api:worker"
            permissionAction="read"
          >
            <Button
              onClick={() => navigate(`${linkPrefix}workers`)}
              startIcon={<HeroServerStackIcon />}
            >
              Workers
            </Button>
          </PermissionWrapper>
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
        </div>
      }
    >
      <EntityFetchTable
        ref={tableRef}
        title="Worker Templates"
        entityName="workerTemplate"
        columns={columns}
        entityFieldMap={WORKER_TEMPLATE_FIELD_MAP}
        defaultSort={{ field: "name", sort: "asc" }}
      />
    </PageContainer>
  );
};

WorkerTemplatesPage.path = "/worker_templates";
