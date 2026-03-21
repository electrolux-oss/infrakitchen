import { useMemo } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, PermissionWrapper, useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
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
            startIcon={<AddIcon />}
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
