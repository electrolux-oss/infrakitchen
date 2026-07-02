import { useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { WORKFLOW_FIELD_MAP } from "../graphql";

export const WorkflowsPage = () => {
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
            entityName="workflow"
            name={params.row.id.slice(0, 8) + "…"}
          />
        ),
      },
      {
        field: "action",
        headerName: "Action",
        flex: 0.7,
        valueGetter: (_value: any, row: any) => row.action.toUpperCase() ?? "",
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
        headerName: "Creator",
        flex: 1,
        sortField: "creator.identifier",
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return <GetEntityLink {...creator} name={creator.identifier} />;
        },
      },
      {
        field: "createdAt",
        headerName: "Created At",
        flex: 1,
        sortField: "created_at",
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "completedAt",
        headerName: "Completed At",
        flex: 1,
        sortField: "completed_at",
        renderCell: (params: GridRenderCellParams) =>
          params.value ? getDateValue(params.value) : "-",
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
        entityFieldMap={WORKFLOW_FIELD_MAP}
      />
    </PageContainer>
  );
};

WorkflowsPage.path = "/workflows";
