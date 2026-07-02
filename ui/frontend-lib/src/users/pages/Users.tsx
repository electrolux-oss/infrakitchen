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
import { USER_FIELD_MAP } from "../graphql/fragments";

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
        fetchFields: ["id", "identifier", "entityName"],
        headerName: "Identifier",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "displayName",
        headerName: "Display Name",
        flex: 1,
      },
      {
        field: "email",
        headerName: "Email",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <Box
            display="flex"
            height="100%"
            sx={{
              wordBreak: "break-all",
              whiteSpace: "normal",
              alignItems: "center",
            }}
          >
            {params.value}
          </Box>
        ),
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
        field: "createdAt",
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
        field: "updatedAt",
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
        field: "firstName",
        headerName: "First Name",
        flex: 1,
      },
      {
        field: "lastName",
        headerName: "Last Name",
        flex: 1,
      },
      {
        field: "deactivated",
        headerName: "Deactivated",
        flex: 1,
      },
      {
        field: "isPrimary",
        headerName: "Is Primary Account",
        flex: 1,
      },
      {
        field: "secondaryAccounts",
        headerName: "Secondary Accounts",
        flex: 1,
        sortField: "primary_account.identifier",
        valueGetter: (_value: any, row: any) =>
          (row.secondaryAccounts || [])
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
            {(params.row.secondaryAccounts || []).map((u: any) => (
              <GetEntityLink key={u.id} {...u} />
            ))}
          </Box>
        ),
      },
      {
        field: "primaryAccount",
        headerName: "Primary Account (Link)",
        flex: 1,
        sortField: "primary_account.identifier",
        valueGetter: (_value: any, row: any) =>
          (row.primaryAccount || []).map((u: any) => u.identifier).join(", "),
        renderCell: (params: GridRenderCellParams) => (
          <Box
            display="flex"
            flexWrap="wrap"
            gap={0.5}
            alignItems="center"
            height="100%"
          >
            {(params.row.primaryAccount || []).map((u: any) => (
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
            Create Service Account User
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Users"
        entityName="user"
        columns={columns}
        entityFieldMap={USER_FIELD_MAP}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        defaultColumnVisibilityModel={{
          updatedAt: false,
          description: false,
          firstName: false,
          lastName: false,
          deactivated: false,
          isPrimary: false,
          secondaryAccounts: false,
          primaryAccount: false,
        }}
      />
    </PageContainer>
  );
};

UsersPage.path = "/users";
