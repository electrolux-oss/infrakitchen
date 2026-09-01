import { Box, Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { createdUpdatedColumns } from "../../common/components/entity_table/tableColumns";
import { PROVIDER_DISPLAY_NAMES } from "../../common/utils";
import { solidChipColorSx } from "../../common/utils/softChip";

const UserIdentifierCell = (params: GridRenderCellParams) => {
  const { currentUser } = useConfig();
  const isCurrentUser = currentUser?.id === params.row.id;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        height: "100%",
      }}
    >
      <GetEntityLink {...params.row} />
      {isCurrentUser ? (
        <Chip
          label="You"
          size="small"
          variant="filled"
          sx={(theme) => ({
            ...solidChipColorSx("info")(theme),
            height: 18,
            fontSize: "0.625rem",
          })}
        />
      ) : null}
    </Box>
  );
};

const USER_AUTH_PROVIDERS = [
  "microsoft",
  "guest",
  "github",
  "google",
  "backstage",
  "ik_service_account",
] as const;

export const userColumns: EntityTableColumn[] = [
  {
    field: "identifier",
    fetchFields: ["id", "identifier", "entityName"],
    headerName: "Identifier",
    flex: 1,
    hideable: false,
    filter: {
      field: "identifier",
      operators: ["like", "eq", "not_like"],
      valueType: "text",
      defaultOperator: "like",
    },
    renderCell: (params: GridRenderCellParams) => (
      <UserIdentifierCell {...params} />
    ),
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
        sx={{
          display: "flex",
          height: "100%",
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
    filter: {
      field: "provider",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: USER_AUTH_PROVIDERS.map((provider) => ({
        label: PROVIDER_DISPLAY_NAMES[provider] || provider,
        value: provider,
      })),
    },
    renderCell: (params: GridRenderCellParams) => (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: "100%",
        }}
      >
        {getProviderValue(params.value)}
      </Box>
    ),
  },
  ...createdUpdatedColumns(),
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
      (row.secondaryAccounts || []).map((u: any) => u.identifier).join(", "),
    renderCell: (params: GridRenderCellParams) => (
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          alignItems: "center",
          height: "100%",
        }}
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
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          alignItems: "center",
          height: "100%",
        }}
      >
        {(params.row.primaryAccount || []).map((u: any) => (
          <GetEntityLink key={u.id} {...u} />
        ))}
      </Box>
    ),
  },
];

export const userDefaultColumnVisibilityModel = {
  updatedAt: false,
  description: false,
  firstName: false,
  lastName: false,
  deactivated: false,
  isPrimary: false,
  secondaryAccounts: false,
  primaryAccount: false,
};
