import { useMemo } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Box, Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, PermissionWrapper, useConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
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
        field: "description",
        headerName: "Description",
        flex: 1,
      },
      {
        field: "first_name",
        headerName: "First Name",
        flex: 1,
      },
      {
        field: "last_name",
        headerName: "Last Name",
        flex: 1,
      },
      {
        field: "deactivated",
        headerName: "Deactivated",
        flex: 1,
      },
      {
        field: "is_primary",
        headerName: "Is Primary Account",
        flex: 1,
      },
      {
        field: "secondary_accounts",
        headerName: "Secondary Accounts",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.secondary_accounts || [])
            .map((u: any) => u.identifier)
            .join(", "),
        renderCell: (params: GridRenderCellParams) => (
          <Box
            display="flex"
            flexWrap="wrap"
            gap={0.5}
            alignItems="center"
            height="100%"
          >
            {(params.row.secondary_accounts || []).map((u: any) => (
              <GetEntityLink key={u.id} {...u} />
            ))}
          </Box>
        ),
      },
      {
        field: "primary_account",
        headerName: "Primary Account (Link)",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.primary_account || []).map((u: any) => u.identifier).join(", "),
        renderCell: (params: GridRenderCellParams) => (
          <Box
            display="flex"
            flexWrap="wrap"
            gap={0.5}
            alignItems="center"
            height="100%"
          >
            {(params.row.primary_account || []).map((u: any) => (
              <GetEntityLink key={u.id} {...u} />
            ))}
          </Box>
        ),
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
            startIcon={<AddIcon />}
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
          "updated_at",
          "description",
          "first_name",
          "last_name",
          "deactivated",
          "is_primary",
          "secondary_accounts",
          "primary_account",
        ]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        defaultColumnVisibilityModel={{
          updated_at: false,
          description: false,
          first_name: false,
          last_name: false,
          deactivated: false,
          is_primary: false,
          secondary_accounts: false,
          primary_account: false,
        }}
      />
    </PageContainer>
  );
};

UsersPage.path = "/users";
