import { useMemo } from "react";

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
import { BLUEPRINT_FIELD_MAP } from "../graphql";
import { transformBlueprintOptional } from "../graphql/transforms";

export const BlueprintsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

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
        entityFieldMap={BLUEPRINT_FIELD_MAP}
        transformFn={transformBlueprintOptional}
      />
    </PageContainer>
  );
};

BlueprintsPage.path = "/blueprints";
