import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  NUMERIC_COLUMN_ALIGN,
  userColumn,
} from "../../common/components/entity_table/tableColumns";

export const batchOperationColumns: EntityTableColumn[] = [
  {
    field: "name",
    headerName: "Name",
    fetchFields: ["name", "id", "entityName"],
    flex: 1,
    hideable: false,
    filter: {
      field: "name",
      operators: ["like", "eq", "not_like"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    renderCell: (params: GridRenderCellParams) => {
      return <Entity entity={params.row} />;
    },
  },
  {
    field: "entityType",
    headerName: "Entity",
    flex: 0.5,
    filter: {
      field: "entity_type",
      label: "Entity Type",
      operators: ["eq"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Resource", value: "resource" },
        { label: "Executor", value: "executor" },
      ],
    },
  },
  {
    field: "entityIds",
    headerName: "# of Entities",
    flex: 0.5,
    ...NUMERIC_COLUMN_ALIGN,
    valueGetter: (value: any) => (value ? value.length : 0),
  },
  ...createdUpdatedColumns(),
  userColumn(),
];
