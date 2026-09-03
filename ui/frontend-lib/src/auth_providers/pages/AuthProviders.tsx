import { useMemo } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button, Switch, Tooltip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper, useConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import { AUTH_PROVIDER_FIELD_MAP } from "../graphql";

export const AuthProvidersPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "entityName"],
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
        field: "authProvider",
        headerName: "Provider",
        flex: 1,
        sortField: "auth_provider",
        renderCell: (params: GridRenderCellParams) =>
          getProviderValue(params.value),
      },
      {
        field: "enabled",
        headerName: "Enabled",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <Tooltip title={params.row.enabled ? "Enabled" : "Disabled"}>
            <Switch
              checked={Boolean(params.row.enabled)}
              sx={{ pointerEvents: "none", cursor: "default" }}
            />
          </Tooltip>
        ),
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 1,
        sortField: "created_at",
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime date={params.value} />
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
          return <GetEntityLink {...creator} />;
        },
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Auth Providers"
      description="Sign-in methods you can enable for your users."
      actions={
        <PermissionWrapper
          requiredPermission="api:auth_provider"
          permissionAction="write"
        >
          <Button
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
      />
    </PageContainer>
  );
};

AuthProvidersPage.path = "/auth_providers";
