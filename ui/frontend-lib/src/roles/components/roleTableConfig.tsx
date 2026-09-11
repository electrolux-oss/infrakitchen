import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";

export const roleColumns: EntityTableColumn[] = [
  {
    field: "v1",
    fetchFields: ["v1"],
    headerName: "Role Name",
    flex: 1,
    hideable: false,
    sortField: "v1",
    filter: {
      field: "v1",
      operators: ["like", "eq", "not_like"],
      valueType: "text",
      defaultOperator: "like",
    },
    renderCell: (params: GridRenderCellParams) => (
      <Entity
        entity={{ id: params.row.v1, entityType: "role", name: params.row.v1 }}
      />
    ),
  },
];
