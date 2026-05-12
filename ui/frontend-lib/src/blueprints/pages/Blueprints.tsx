import { useCallback, useMemo } from "react";

import { useNavigate } from "react-router";

import { Box, Button, Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, PermissionWrapper } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { BLUEPRINTS_QUERY, BLUEPRINTS_COUNT_QUERY } from "../graphql/queries";
import {
  GqlBlueprintListItem,
  transformBlueprintListItem,
} from "../graphql/transforms";

export const BlueprintsPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const fetchBlueprints = useCallback(
    async (params: {
      filter: Record<string, any>;
      sort: { field: string; order: "ASC" | "DESC" };
      pagination: { page: number; perPage: number };
      fields: string[];
    }) => {
      const gqlFilter =
        Object.keys(params.filter).length > 0 ? params.filter : null;
      const gqlSort = [params.sort.field, params.sort.order];
      const skip = (params.pagination.page - 1) * params.pagination.perPage;
      const end = skip + params.pagination.perPage;
      const gqlRange = [skip, end];

      const [listResult, countResult] = await Promise.all([
        ikApi.graphqlRequest<{ blueprints: GqlBlueprintListItem[] }>(
          BLUEPRINTS_QUERY,
          {
            filter: gqlFilter,
            sort: gqlSort,
            range: gqlRange,
          },
        ),
        ikApi.graphqlRequest<{ blueprintsCount: number }>(
          BLUEPRINTS_COUNT_QUERY,
          {
            filter: gqlFilter,
          },
        ),
      ]);

      return {
        data: listResult.blueprints.map(transformBlueprintListItem),
        total: countResult.blueprintsCount,
      };
    },
    [ikApi],
  );

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <GetEntityLink
            id={params.row.id}
            _entity_name="blueprint"
            name={params.row.name}
          />
        ),
      },
      {
        field: "description",
        headerName: "Description",
        flex: 1.5,
      },
      {
        field: "templates",
        headerName: "Templates",
        flex: 1.5,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          const templates = params.row.templates ?? [];
          return (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {templates.slice(0, 3).map((t: any) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              {templates.length > 3 && (
                <Chip
                  label={`+${templates.length - 3}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          );
        },
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
        field: "updated_at",
        headerName: "Last Updated",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "name",
        type: "search" as const,
        label: "Search",
        width: 420,
      },
      {
        id: "status",
        type: "autocomplete" as const,
        label: "Status",
        options: ["enabled", "disabled"],
        multiple: true,
        width: 300,
      },
    ],
    [],
  );

  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.name) {
      apiFilters["name__like"] = filterValues.name;
    }
    if (filterValues.status && filterValues.status.length > 0) {
      apiFilters["status__in"] = filterValues.status;
    }

    return apiFilters;
  };

  const actions = (
    <Box>
      <PermissionWrapper
        requiredPermission="api:blueprint"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => navigate(`${linkPrefix}blueprints/create`)}
        >
          Create
        </Button>
      </PermissionWrapper>
    </Box>
  );

  return (
    <PageContainer title="Blueprints" actions={actions}>
      <EntityFetchTable
        title="Blueprints"
        entityName="blueprint"
        columns={columns}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        fetchListFn={fetchBlueprints}
        fields={[
          "id",
          "name",
          "description",
          "templates",
          "labels",
          "status",
          "updated_at",
        ]}
      />
    </PageContainer>
  );
};

BlueprintsPage.path = "/blueprints";
