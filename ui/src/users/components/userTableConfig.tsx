import { useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { createdUpdatedColumns } from "../../common/components/entity_table/tableColumns";
import { getProviderValue } from "../../common/components/fields/CommonField";
import { Label } from "../../common/components/labels";
import { PROVIDER_DISPLAY_NAMES } from "../../common/utils";
import { RenderCellParams } from "../../ui";

const UserIdentifierCell = (params: RenderCellParams) => {
  const { currentUser } = useConfig();
  const isCurrentUser = currentUser?.id === params.row.id;

  return (
    <div className="flex h-full items-center gap-1">
      <Entity entity={{ ...params.row, entityType: "user" }} />
      {isCurrentUser ? <Label size="small" tone="info" label="You" /> : null}
    </div>
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
    renderCell: (params: RenderCellParams) => (
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
    renderCell: (params: RenderCellParams) => (
      <div className="flex h-full items-center break-all whitespace-normal">
        {params.value}
      </div>
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
    renderCell: (params: RenderCellParams) => (
      <div className="flex h-full items-center">
        {getProviderValue(params.value, 18)}
      </div>
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
    renderCell: (params: RenderCellParams) => (
      <div className="flex h-full flex-wrap items-center gap-1">
        {(params.row.secondaryAccounts || []).map((u: any) => (
          <Entity key={u.id} entity={{ ...u, entityType: "user" }} />
        ))}
      </div>
    ),
  },
  {
    field: "primaryAccount",
    headerName: "Primary Account (Link)",
    flex: 1,
    sortField: "primary_account.identifier",
    valueGetter: (_value: any, row: any) =>
      (row.primaryAccount || []).map((u: any) => u.identifier).join(", "),
    renderCell: (params: RenderCellParams) => (
      <div className="flex h-full flex-wrap items-center gap-1">
        {(params.row.primaryAccount || []).map((u: any) => (
          <Entity key={u.id} entity={{ ...u, entityType: "user" }} />
        ))}
      </div>
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
