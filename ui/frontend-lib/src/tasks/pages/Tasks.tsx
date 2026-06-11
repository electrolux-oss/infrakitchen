import { useCallback, useMemo } from "react";

import { useNavigate } from "react-router";

import { Link } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { TASK_FIELD_MAP, transformTask } from "../graphql";

export const TasksPage = () => {
  const { linkPrefix, globalConfig } = useConfig();

  const navigate = useNavigate();

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "entity",
        type: "autocomplete" as const,
        label: "Entity Type",
        options: globalConfig.entities,
        multiple: true,
        width: 420,
      },
    ],
    [globalConfig.entities],
  );

  // Build API filters
  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.entity && filterValues.entity.length > 0) {
      apiFilters["entity__in"] = filterValues.entity;
    }

    return apiFilters;
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "entity",
        fetchFields: ["entity", "entity_id", "entity_data"],
        headerName: "Entity",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <Link
              onClick={() => {
                navigate(
                  `${linkPrefix}${params.row.entity}s/${params.row.entity_id}`,
                );
              }}
              rel="noopener"
              style={{ cursor: "pointer" }}
            >
              {params.row.entity_data?.name ?? params.row.entity}
            </Link>
          );
        },
      },
      {
        field: "status",
        fetchFields: ["status", "state"],
        headerName: "Status",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={params.row.status} state={params.row.state} />
        ),
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
      {
        field: "updated_at",
        headerName: "Last Updated",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
      {
        field: "creator",
        headerName: "Creator",
        flex: 1,
        sortField: "creator.identifier",
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) =>
          params.row.creator ? <GetEntityLink {...params.row.creator} /> : null,
      },
    ],
    [navigate, linkPrefix],
  );

  return (
    <PageContainer title="Tasks">
      <EntityFetchTable
        title="Tasks"
        entityName="task"
        columns={columns}
        entityFieldMap={TASK_FIELD_MAP}
        transformFn={transformTask}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        defaultColumnVisibilityModel={{
          created_by: false,
        }}
      />
    </PageContainer>
  );
};

TasksPage.path = "/tasks";
