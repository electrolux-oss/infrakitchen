import { Box, Typography } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import {
  Entity,
  humanizeEntityType,
} from "../../common/components/entities/Entity";
import { UserAvatar } from "../../common/components/entities/UserAvatar";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { Label } from "../../common/components/labels/Label";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { GqlAuditLog } from "../graphql";
import { getAuditLogEntity } from "../utils/auditLogEntity";

import { AuditExecutionResult } from "./AuditExecutionResult";
import { DeletedEntityCell } from "./DeletedEntityCell";

/**
 * Merges the actor avatar with the relative time: an audit row reads as
 * "who, when" pairs in one narrow cell. Sorting stays on `created_at` and
 * filtering on the user reference — reusing userColumn() preserves both.
 */
const userTimeColumn = (): EntityTableColumn => ({
  ...userColumn({ headerName: "Date", filterField: "user_id" }),
  // Label override: without it the filter dropdown would read "Date".
  filter: {
    field: "user_id",
    label: "User",
    operators: ["eq", "in"],
    valueType: "reference",
    defaultOperator: "eq",
    makeReferenceLoader: serverSearchReference({
      entityPlural: "users",
      labelField: "identifier",
    }),
  },
  // 112px (time column) + ~38px avatar.
  width: RELATIVE_TIME_COLUMN_WIDTH + 38,
  align: "right",
  headerAlign: "right",
  sortField: "created_at",
  fetchFields: ["creator", "createdAt"],
  renderCell: (params: GridRenderCellParams<GqlAuditLog>) => {
    const user = params.row.creator;
    return (
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
      >
        <RelativeTime date={params.row.createdAt} compact />
        {user?.id ? (
          <UserAvatar id={user.id} identifier={user.identifier} />
        ) : (
          <Typography variant="caption">System</Typography>
        )}
      </Box>
    );
  },
});

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
    fetchFields: ["model", "entityId", "entityData", "action", "metadata"],
    headerName: "Entity",
    flex: 2.5,
    sortable: true,
    sortField: "entity_id",
    hideable: false,
    valueGetter: (value: string) => value,
    renderCell: (params: GridRenderCellParams<GqlAuditLog>) => {
      const { entity, isDeleted } = getAuditLogEntity(params.row);
      // All rows show the entity UUID beneath the name for cross-
      // referencing; gone entities render as "[Deleted]" instead of a
      // model-name fallback.
      const exists = !!entity;
      const uuidLine = params.row.entityId ? (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: CODE_FONT_FAMILY,
              color: "text.secondary",
              wordBreak: "break-all",
            }}
          >
            {params.row.entityId}
          </Typography>
          <Label label={humanizeEntityType(params.row.model)} />
        </Box>
      ) : null;
      // Only chip the 1st row when it adds the nested template's name;
      // otherwise the type is already stated on the UUID row.
      const showTemplateChip = !!entity?.template?.name;
      return exists ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.25,
            minWidth: 0,
          }}
        >
          <Entity
            entity={{
              ...entity,
              id: params.row.entityId,
              entityType: params.row.model,
              name: entity.name,
            }}
            showLifecycleState={false}
            showLabel={showTemplateChip}
            disableLink={isDeleted}
          />
          {uuidLine}
        </Box>
      ) : (
        <DeletedEntityCell
          entityId={params.row.entityId}
          entityType={params.row.model}
        />
      );
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
    field: "result",
    fetchFields: ["metadata"],
    headerName: "Result",
    flex: 2,
    sortable: false,
    valueGetter: (_value: unknown, row: GqlAuditLog) =>
      row.metadata?.execution ?? null,
    renderCell: (params: GridRenderCellParams<GqlAuditLog>) => (
      <AuditExecutionResult log={params.row} />
    ),
  },
  userTimeColumn(),
];
