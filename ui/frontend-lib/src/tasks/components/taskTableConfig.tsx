import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  RELATIVE_TIME_COLUMN_WIDTH,
} from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";

export const taskDefaultColumnVisibilityModel: GridColumnVisibilityModel = {
  creator: false,
};

export const taskColumns = (): EntityTableColumn[] => [
  {
    field: "entity",
    fetchFields: ["entity", "entityId", "entityData"],
    headerName: "Entity",
    // Entity names can be long; give this column most of the remaining space
    // (matches the audit log table's Entity emphasis).
    flex: 2.5,
    hideable: false,
    filter: {
      field: "entity",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      optionsKey: "entities",
    },
    renderCell: (params: GridRenderCellParams) => (
      <Entity
        entity={{
          ...params.row.entityData,
          id: params.row.entityId,
          entityType: params.row.entity,
          name: params.row.entityData?.name ?? params.row.entity,
        }}
        showLabel
      />
    ),
  },
  {
    field: "status",
    fetchFields: ["status", "state"],
    headerName: "Status",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={params.row.status} state={params.row.state} />
    ),
  },
  ...createdUpdatedColumns({
    createdSortField: "created_at",
    updatedSortField: "updated_at",
  }),
  {
    field: "runAt",
    headerName: "Run At",
    sortField: "run_at",
    // Same fixed width as the Created / Last Updated time columns.
    width: RELATIVE_TIME_COLUMN_WIDTH,
    renderCell: (params: GridRenderCellParams) =>
      params.value ? <RelativeTime date={params.value} /> : null,
  },
  {
    field: "creator",
    headerName: "Creator",
    flex: 1,
    sortField: "creator.identifier",
    filter: {
      field: "created_by",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "users",
        labelField: "identifier",
      }),
    },
    valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
    renderCell: (params: GridRenderCellParams) => (
      <Entity entity={{ ...params.row.creator, entityType: "user" }} />
    ),
  },
];
