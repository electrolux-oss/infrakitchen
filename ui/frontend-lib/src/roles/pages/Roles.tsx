import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
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
        headerName: "Role Name",
        sortable: false,
        flex: 1,
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
        fields={["id"]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

RolesPage.path = "/roles";
