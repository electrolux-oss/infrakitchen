import { useMemo } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Box, Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper, useConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
  getBooleanLabel,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import {
  AUTH_PROVIDER_FIELD_MAP,
  transformAuthProviderOptional,
} from "../graphql";

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
          getBooleanLabel(params.row.enabled),
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
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Auth Providers"
        entityName="authProvider"
        columns={columns}
        entityFieldMap={AUTH_PROVIDER_FIELD_MAP}
        transformFn={transformAuthProviderOptional}
      />
    </PageContainer>
  );
};

AuthProvidersPage.path = "/auth_providers";
