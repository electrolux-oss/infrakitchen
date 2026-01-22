import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Button, Box } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper, useConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";

export const AuthProvidersPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        hideable: false,
        fetchFields: ["id", "name"],
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "description",
        headerName: "Description",
        flex: 1,
      },
      {
        field: "auth_provider",
        headerName: "Provider",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <Box display="flex" alignItems="center" height="100%">
            {getProviderValue(params.value)}
          </Box>
        ),
      },
      {
        field: "enabled",
        headerName: "Enabled",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          String(params.row.enabled).toLowerCase(),
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
      title="Auth Providers"
      actions={
        <PermissionWrapper
          requiredPermission="api:auth_provider"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}auth_providers/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Auth Providers"
        entityName="auth_provider"
        columns={columns}
      />
    </PageContainer>
  );
};

AuthProvidersPage.path = "/auth_providers";
