import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Button, Box } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";

export const UsersPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "identifier",
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

    if (filterValues.identifier && filterValues.identifier.trim().length > 0) {
      apiFilters["identifier__like"] = filterValues.identifier;
    }

    return apiFilters;
  };

  const columns = useMemo(
    () => [
      {
        field: "identifier",
        headerName: "Identifier",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "display_name",
        headerName: "Display Name",
        flex: 1,
      },
      {
        field: "email",
        headerName: "Email",
        flex: 1,
      },
      {
        field: "provider",
        headerName: "Provider",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <Box display="flex" alignItems="center" height="100%">
            {getProviderValue(params.value)}
          </Box>
        ),
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Users"
      actions={
        <PermissionWrapper
          requiredPermission="api:user"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}users/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Users"
        entityName="user"
        columns={columns}
        fields={[
          "id",
          "identifier",
          "display_name",
          "email",
          "provider",
          "created_at",
        ]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

UsersPage.path = "/users";
