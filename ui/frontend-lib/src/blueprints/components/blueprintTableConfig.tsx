import { Box, Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { solidChipColorSx } from "../../common/utils/softChip";
import StatusChip from "../../common/StatusChip";

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
      <GetEntityLink {...params.row} />
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
