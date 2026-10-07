import { Box, Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { userColumn } from "../../common/components/entity_table/tableColumns";
import { getDateValue } from "../../common/components/fields/CommonField";
import StatusChip from "../../common/StatusChip";
import { solidChipColorSx } from "../../common/utils/softChip";

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
    renderCell: (params: GridRenderCellParams) => (
      <Entity entity={params.row} />
    ),
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
    renderCell: (params: GridRenderCellParams) => {
      const templates = params.row.templates ?? [];
      return (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {templates.slice(0, 3).map((t: any) => (
            <Chip
              key={t.id}
              label={t.name}
              variant="filled"
              sx={(theme) =>
                solidChipColorSx("default", undefined, undefined, true)(theme)
              }
            />
          ))}
          {templates.length > 3 && (
            <Chip
              label={`+${templates.length - 3}`}
              variant="filled"
              sx={(theme) =>
                solidChipColorSx("default", undefined, undefined, true)(theme)
              }
            />
          )}
        </Box>
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
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={String(params.row.status).toLowerCase()} />
    ),
  },
  {
    field: "updatedAt",
    headerName: "Last Updated",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => getDateValue(params.value),
  },
  userColumn(),
];
