import { GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
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
      <GetEntityLink
        entityName="role"
        identifier={params.row.v1}
        id={params.row.v1}
      />
    ),
  },
];
