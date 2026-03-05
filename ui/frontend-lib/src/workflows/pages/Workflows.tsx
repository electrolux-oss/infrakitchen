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
            _entity_name="workflow"
            name={params.row.id.slice(0, 8) + "…"}
          />
        ),
      },
      {
        field: "blueprint_id",
        headerName: "Blueprint",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <GetEntityLink
            id={params.row.blueprint_id}
            _entity_name="blueprint"
            name={params.row.blueprint_id.slice(0, 8) + "…"}
          />
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
        valueGetter: (_value: any, row: any) => {
          const creator = row.creator;
          if (!creator) return "—";
          return typeof creator === "string"
            ? creator
            : creator.identifier || "Unknown";
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
