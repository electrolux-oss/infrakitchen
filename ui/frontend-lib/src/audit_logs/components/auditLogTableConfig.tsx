import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  relativeTimeColumn,
  userColumn,
} from "../../common/components/entity_table/tableColumns";

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
    flex: 2.5,
    sortable: true,
    sortField: "entity_id",
    hideable: false,
    valueGetter: (value: string) => value,
    renderCell: (params: GridRenderCellParams) => {
      return (
        <Entity
          entity={{
            ...params.row.entityData,
            id: params.row.entityId,
            entityType: params.row.model,
            name: params.row.entityData?.name ?? params.row.model,
          }}
          showLifecycleState={false}
          showLabel
        />
      );
    },
  },
  userColumn({ headerName: "User", filterField: "user_id" }),
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
  relativeTimeColumn("createdAt", "Time", { sortField: "created_at" }),
];
