import { useMemo } from "react";

import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import type { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import { getProviderValue } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import PageContainer from "../../common/PageContainer";
import { AddIcon } from "../../icons/material";
import { Switch, Button, Tooltip } from "../../ui";
import { RenderCellParams } from "../../ui";
import { AUTH_PROVIDER_FIELD_MAP } from "../graphql";

export const AuthProvidersPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  const columns = useMemo<EntityTableColumn[]>(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "entityName"],
        flex: 1,
        hideable: false,
        renderCell: (params: RenderCellParams) => {
          return <Entity entity={params.row} />;
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
        renderCell: (params: RenderCellParams) =>
          getProviderValue(params.value, 18),
      },
      {
        field: "enabled",
        headerName: "Enabled",
        flex: 1,
        renderCell: (params: RenderCellParams) => (
          <Tooltip title={params.row.enabled ? "Enabled" : "Disabled"}>
            <Switch
              className="pointer-events-none cursor-default"
              checked={Boolean(params.row.enabled)}
            />
          </Tooltip>
        ),
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        align: "right",
        headerAlign: "right",
        sortField: "created_at",
        renderCell: (params: RenderCellParams) => (
          <RelativeTime date={params.value} compact />
        ),
      },
      userColumn({ disableFilter: true }),
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
