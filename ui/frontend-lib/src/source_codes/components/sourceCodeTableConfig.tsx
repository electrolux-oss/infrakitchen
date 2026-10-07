import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { getRepoNameFromUrl } from "../../common";
import { CodeRepository } from "../../common/components/entities/CodeRepository";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  labelsColumn,
  relativeTimeColumn,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATUS } from "../../utils/constants";

export const sourceCodeDefaultColumnVisibilityModel: GridColumnVisibilityModel =
  {
    description: false,
    creator: false,
  };

export const sourceCodeColumns: EntityTableColumn[] = [
  {
    field: "sourceCodeUrl",
    headerName: "Name",
    flex: 1,
    fetchFields: ["sourceCodeUrl", "entityName", "sourceCodeProvider"],
    filter: {
      field: "source_code_url",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    valueGetter: (_value: any, row: any) =>
      getRepoNameFromUrl(row.sourceCodeUrl || ""),
    renderCell: (params: GridRenderCellParams) => (
      <CodeRepository {...params.row} />
    ),
  },
  {
    field: "description",
    headerName: "Description",
  },
  labelsColumn("source_code"),
  {
    field: "status",
    headerName: "Status",
    flex: 1,
    filter: {
      field: "status",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Queued", value: ENTITY_STATUS.QUEUED },
        { label: "In Progress", value: ENTITY_STATUS.IN_PROGRESS },
        { label: "Done", value: ENTITY_STATUS.DONE },
        { label: "Error", value: ENTITY_STATUS.ERROR },
        { label: "Unknown", value: ENTITY_STATUS.UNKNOWN },
        { label: "Pending", value: ENTITY_STATUS.PENDING },
        { label: "Ready", value: ENTITY_STATUS.READY },
      ],
    },
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={params.row.status} />
    ),
  },
  relativeTimeColumn("updatedAt", "Last Updated", {
    sortField: "updated_at",
  }),
  userColumn(),
];
