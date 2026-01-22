import { useState, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Link } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig } from "../../common";
import { getDateValue } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const TasksPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const [entities, setEntities] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    ikApi.getList("entities", {}).then((response) => {
      setEntities(response.data);
    });
  }, [ikApi]);

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "entity",
        type: "autocomplete" as const,
        label: "Entity Type",
        options: entities,
        multiple: true,
        width: 420,
      },
    ],
    [entities],
  );

  // Build API filters
  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.entity && filterValues.entity.length > 0) {
      apiFilters["entity__in"] = filterValues.entity;
    }

    return apiFilters;
  };

  const columns = useMemo(
    () => [
      {
        field: "entity",
        headerName: "Entity",
        flex: 1,
        hideable: false,
        fetchFields: ["entity", "entity_id"],
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
              {params.row.entity}
            </Link>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        fetchFields: ["status", "state"],
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={params.row.status} state={params.row.state} />
        ),
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "updated_at",
        headerName: "Updated At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
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
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

TasksPage.path = "/tasks";
