import { GridRenderCellParams } from "@mui/x-data-grid";

import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATUS } from "../../utils/constants";

export const workflowColumns: EntityTableColumn[] = [
  {
    field: "id",
    headerName: "Workflow",
    flex: 1,
    hideable: false,
    renderCell: (params: GridRenderCellParams) => (
      <GetEntityLink
        id={params.row.id}
        entityName="workflow"
        name={params.row.id.slice(0, 8) + "..."}
      />
    ),
  },
  {
    field: "action",
    headerName: "Action",
    flex: 0.7,
    valueGetter: (_value: any, row: any) => row.action.toUpperCase() ?? "",
  },
  {
    field: "status",
    headerName: "Status",
    flex: 0.7,
    filter: {
      field: "status",
      operators: ["eq"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Pending", value: ENTITY_STATUS.PENDING },
        { label: "In Progress", value: ENTITY_STATUS.IN_PROGRESS },
        { label: "Done", value: ENTITY_STATUS.DONE },
        { label: "Error", value: ENTITY_STATUS.ERROR },
        { label: "Approval Pending", value: ENTITY_STATUS.APPROVAL_PENDING },
        { label: "Rejected", value: ENTITY_STATUS.REJECTED },
        { label: "Ready", value: ENTITY_STATUS.READY },
      ],
    },
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={String(params.row.status).toLowerCase()} />
    ),
  },
  {
    field: "steps",
    headerName: "Steps",
    flex: 0.5,
    sortable: false,
    valueGetter: (_value: any, row: any) => row.steps?.length ?? 0,
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
  {
    field: "createdAt",
    headerName: "Created At",
    flex: 1,
    sortField: "created_at",
    renderCell: (params: GridRenderCellParams) => getDateValue(params.value),
  },
  {
    field: "completedAt",
    headerName: "Completed At",
    flex: 1,
    sortField: "completed_at",
    renderCell: (params: GridRenderCellParams) =>
      params.value ? getDateValue(params.value) : "-",
  },
];
