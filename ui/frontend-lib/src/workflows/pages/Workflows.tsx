import { useCallback, useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { getGraphQLClient, initGraphQLClient } from "../../graphql/client";
import { WORKFLOWS_QUERY, WORKFLOWS_COUNT_QUERY } from "../graphql/queries";
import {
  GqlWorkflowListItem,
  transformWorkflowListItem,
} from "../graphql/transforms";

export const WorkflowsPage = () => {
  const { ikApi } = useConfig();

  const fetchWorkflows = useCallback(
    async (params: {
      filter: Record<string, any>;
      sort: { field: string; order: "ASC" | "DESC" };
      pagination: { page: number; perPage: number };
    }) => {
      try {
        getGraphQLClient();
      } catch {
        initGraphQLClient(ikApi);
      }
      const client = getGraphQLClient();

      const gqlFilter =
        Object.keys(params.filter).length > 0 ? params.filter : null;
      const gqlSort = [params.sort.field, params.sort.order];
      const skip = (params.pagination.page - 1) * params.pagination.perPage;
      const end = skip + params.pagination.perPage;
      const gqlRange = [skip, end];

      const [listResult, countResult] = await Promise.all([
        client.request<{ workflows: GqlWorkflowListItem[] }>(WORKFLOWS_QUERY, {
          filter: gqlFilter,
          sort: gqlSort,
          range: gqlRange,
        }),
        client.request<{ workflowsCount: number }>(WORKFLOWS_COUNT_QUERY, {
          filter: gqlFilter,
        }),
      ]);

      return {
        data: listResult.workflows.map(transformWorkflowListItem),
        total: countResult.workflowsCount,
      };
    },
    [ikApi],
  );

  const columns = useMemo(
    () => [
      {
        field: "id",
        headerName: "Workflow",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <GetEntityLink
            id={params.row.id}
            _entity_name="workflow"
            name={params.row.id.slice(0, 8) + "…"}
          />
        ),
      },
      {
        field: "blueprint_id",
        headerName: "Blueprint",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          params.row.blueprint_id ? (
            <GetEntityLink
              id={params.row.blueprint_id}
              _entity_name="blueprint"
              name={
                params.row.blueprint_name ??
                params.row.blueprint_id.slice(0, 8) + "…"
              }
            />
          ) : (
            "—"
          ),
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.7,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={String(params.row.status).toLowerCase()} />
        ),
      },
      {
        field: "steps",
        headerName: "Steps",
        flex: 0.5,
        sortable: false,
        valueGetter: (_value: any, row: any) => row.steps?.length ?? 0,
      },
      {
        field: "creator",
        headerName: "Created By",
        flex: 0.8,
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return <GetEntityLink {...creator} name={creator.identifier} _entity_name="user" />;
        },
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "completed_at",
        headerName: "Completed At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          params.value ? getDateValue(params.value) : "—",
      },
    ],
    [],
  );

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "status",
        type: "autocomplete" as const,
        label: "Status",
        options: ["pending", "in_progress", "done", "error", "cancelled"],
        multiple: true,
        width: 300,
      },
    ],
    [],
  );

  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.status && filterValues.status.length > 0) {
      apiFilters["status__in"] = filterValues.status;
    }

    return apiFilters;
  };

  return (
    <PageContainer title="Workflows">
      <EntityFetchTable
        title="Workflows"
        entityName="workflow"
        columns={columns}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        fetchListFn={fetchWorkflows}
        fields={[
          "id",
          "blueprint_id",
          "status",
          "steps",
          "creator",
          "created_at",
          "completed_at",
        ]}
      />
    </PageContainer>
  );
};

WorkflowsPage.path = "/workflows";
