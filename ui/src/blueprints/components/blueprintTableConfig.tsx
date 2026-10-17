import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import StatusChip from "../../common/StatusChip";
import { Chip } from "../../ui";
import { RenderCellParams } from "../../ui";

export const blueprintColumns: EntityTableColumn[] = [
  {
    field: "name",
    fetchFields: ["name", "entityName"],
    headerName: "Name",
    flex: 1,
    hideable: false,
    filter: {
      field: "name",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    renderCell: (params: RenderCellParams) => <Entity entity={params.row} />,
  },
  {
    field: "description",
    headerName: "Description",
    flex: 1.5,
  },
  {
    field: "templates",
    headerName: "Templates",
    flex: 1.5,
    sortable: false,
    renderCell: (params: RenderCellParams) => {
      const templates = params.row.templates ?? [];
      return (
        <div className="flex flex-wrap gap-1">
          {templates.slice(0, 3).map((t: any) => (
            <Chip key={t.id} label={t.name} appearance="solid" compact />
          ))}
          {templates.length > 3 && (
            <Chip
              label={`+${templates.length - 3}`}
              appearance="solid"
              compact
            />
          )}
        </div>
      );
    },
  },
  {
    field: "status",
    headerName: "Status",
    flex: 0.7,
    filter: {
      field: "status",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Enabled", value: "enabled" },
        { label: "Disabled", value: "disabled" },
      ],
    },
    renderCell: (params: RenderCellParams) => (
      <StatusChip status={String(params.row.status).toLowerCase()} />
    ),
  },
  ...createdUpdatedColumns(),
  userColumn(),
];
