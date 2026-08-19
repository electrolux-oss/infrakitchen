import { GridRenderCellParams } from "@mui/x-data-grid";

import { Labels } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATUS } from "../../utils/constants";

export const sourceCodeColumns: EntityTableColumn[] = [
  {
    field: "sourceCodeUrl",
    headerName: "Repository URL",
    flex: 1,
    fetchFields: ["sourceCodeUrl", "entityName"],
    filter: {
      field: "source_code_url",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const sourceCode = params.row;
      return (
        <GetEntityLink {...sourceCode} identifier={sourceCode.sourceCodeUrl} />
      );
    },
  },
  {
    field: "description",
    headerName: "Description",
  },
  {
    field: "labels",
    headerName: "Labels",
    flex: 1,
    filter: {
      field: "labels",
      operators: ["contains_all"],
      valueType: "autocomplete-multiple",
      defaultOperator: "contains_all",
      labelsEntity: "source_code",
    },
    valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
    renderCell: (params: GridRenderCellParams) => (
      <Labels labels={params.row.labels || []} />
    ),
  },
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
