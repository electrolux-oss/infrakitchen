import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATUS } from "../../utils/constants";
import { getWorkerProviderLabel } from "../providers";

export const workerTemplateColumns: EntityTableColumn[] = [
  {
    field: "name",
    headerName: "Name",
    fetchFields: ["id", "name", "entityName"],
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
    flex: 1,
  },
  {
    field: "provider",
    headerName: "Provider",
    flex: 1,
    valueGetter: (value: string) => getWorkerProviderLabel(value),
  },
  {
    field: "maxWorkers",
    headerName: "Max workers",
    sortField: "max_workers",
    flex: 1,
  },
  {
    field: "idleTimeoutSeconds",
    headerName: "Idle timeout (s)",
    sortField: "idle_timeout_seconds",
    flex: 1,
  },
  {
    field: "priority",
    headerName: "Priority",
    flex: 1,
  },
  {
    field: "state",
    fetchFields: ["state", "status"],
    headerName: "State",
    flex: 1,
    filter: {
      field: "status",
      label: "Status",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Enabled", value: ENTITY_STATUS.ENABLED },
        { label: "Disabled", value: ENTITY_STATUS.DISABLED },
      ],
    },
    valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip
        status={String(params.row.status).toLowerCase()}
        state={String(params.row.state).toLowerCase()}
      />
    ),
  },
  ...createdUpdatedColumns(),
  userColumn({ disableFilter: true }),
];

export const workerTemplateDefaultColumnVisibilityModel: GridColumnVisibilityModel =
  {
    description: false,
    idleTimeoutSeconds: false,
    updatedAt: false,
  };
