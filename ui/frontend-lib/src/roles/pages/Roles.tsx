import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";

export const RolesPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "v1",
        type: "search" as const,
        label: "Search",
        width: 420,
      },
    ],
    [],
  );

  // Build API filters
  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.v1 && filterValues.v1.trim().length > 0) {
      apiFilters["v1__like"] = filterValues.v1;
    }

    return apiFilters;
  };

  const columns = useMemo(
    () => [
      {
        field: "id",
        fetchFields: ["id", "v1"],
        headerName: "Role Name",
        sortable: false,
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              _entity_name={"role"}
              identifier={params.row.v1}
              id={params.row.v1}
            />
          );
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
        field: "updated_at",
        headerName: "Updated At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "creator",
        headerName: "Creator",
        flex: 1,
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) =>
          params.row.creator ? <GetEntityLink {...params.row.creator} /> : null,
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Roles"
      actions={
        <PermissionWrapper
          requiredPermission="api:permission"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}roles/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Roles"
        entityName="permissions/role"
        columns={columns}
        fields={["id", "v1", "created_at", "updated_at", "creator"]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        defaultColumnVisibilityModel={{
          created_at: false,
          updated_at: false,
          creator: false,
        }}
      />
    </PageContainer>
  );
};

RolesPage.path = "/roles";
