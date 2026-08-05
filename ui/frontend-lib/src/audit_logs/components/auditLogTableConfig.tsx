import { GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { RelativeTime } from "../../common/components/RelativeTime";

const AUDIT_LOG_ACTION_OPTIONS = [
  "approve",
  "cascade_destroy",
  "create",
  "delete",
  "destroy",
  "disable",
  "dryrun",
  "dryrun_with_temp_state",
  "edit",
  "enable",
  "execute",
  "link_accounts",
  "login",
  "recreate",
  "reject",
  "retry",
  "sync",
  "update",
];

export const auditLogColumns: EntityTableColumn[] = [
  {
    field: "entityId",
    fetchFields: ["model", "entityId", "entityData"],
    headerName: "Entity",
    flex: 1,
    sortable: true,
    sortField: "entity_id",
    hideable: false,
    valueGetter: (value: string) => value,
    renderCell: (params: GridRenderCellParams) => {
      return (
        <GetEntityLink
          id={params.row.entityId}
          entityName={params.row.model}
          name={params.row.entityData?.name ?? params.row.model}
        />
      );
    },
  },
  {
    field: "creator",
    headerName: "User",
    flex: 1,
    sortField: "creator.identifier",
    filter: {
      field: "user_id",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "users",
        labelField: "identifier",
      }),
    },
    valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
    renderCell: (params: GridRenderCellParams) => {
      const creator = params.row.creator;
      if (creator?.id) {
        return (
          <GetEntityLink
            id={creator.id}
            entityName="user"
            name={creator.identifier}
          />
        );
      }
      return null;
    },
  },
  {
    field: "action",
    headerName: "Event",
    flex: 1,
    filter: {
      field: "action",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      options: AUDIT_LOG_ACTION_OPTIONS,
    },
    renderCell: (params: GridRenderCellParams) => params.value,
  },
  {
    field: "model",
    headerName: "Model",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => params.value,
  },
  {
    field: "createdAt",
    headerName: "Time",
    flex: 1,
    sortField: "created_at",
    renderCell: (params: GridRenderCellParams) => (
      <RelativeTime
        date={params.value}
        sx={{ fontSize: "0.75rem", display: "flex" }}
      />
    ),
  },
];
