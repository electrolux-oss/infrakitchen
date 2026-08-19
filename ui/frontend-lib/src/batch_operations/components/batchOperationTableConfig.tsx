import { GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { RelativeTime } from "../../common/components/RelativeTime";

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
      return <GetEntityLink {...params.row} />;
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
    valueGetter: (value: any) => (value ? value.length : 0),
  },
  {
    field: "createdAt",
    headerName: "Created",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <RelativeTime
        date={params.value}
        sx={{ fontSize: "0.75rem", display: "flex" }}
      />
    ),
  },
  {
    field: "updatedAt",
    headerName: "Last Updated",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <RelativeTime
        date={params.value}
        sx={{ fontSize: "0.75rem", display: "flex" }}
      />
    ),
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
    renderCell: (params: GridRenderCellParams) => {
      const creator = params.row.creator;
      if (!creator) return null;
      return <GetEntityLink {...creator} name={creator.identifier} />;
    },
  },
];
