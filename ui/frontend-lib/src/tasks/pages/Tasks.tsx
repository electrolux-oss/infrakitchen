import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { Link } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const TasksPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const [entities, setEntities] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    ikApi.get("entities", {}).then((response) => {
      setEntities(response);
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
        fetchFields: ["entity", "entity_id"],
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
              {params.row.entity}
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
        field: "created_by",
        headerName: "Created By",
        flex: 1,
        valueGetter: (_value: any, row: any) => {
          const cb = row.created_by;
          return typeof cb === "object" && cb !== null ? cb.identifier : cb;
        },
        renderCell: (params: GridRenderCellParams) => {
          const cb = params.row.created_by;
          if (typeof cb === "object" && cb !== null) {
            return <GetEntityLink {...cb} />;
          }
          return cb ?? null;
        },
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
        fields={[
          "id",
          "entity",
          "entity_id",
          "status",
          "state",
          "created_at",
          "updated_at",
          "created_by",
        ]}
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
