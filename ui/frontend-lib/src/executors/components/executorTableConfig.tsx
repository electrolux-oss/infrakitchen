import { Stack } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { getRepoNameFromUrl } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  labelsColumn,
} from "../../common/components/entity_table/tableColumns";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";
import { ProviderIcon } from "../../icons/Icons";
import { ENTITY_STATE, ENTITY_STATUS } from "../../utils/constants";

export const executorColumns: EntityTableColumn[] = [
  {
    field: "Favorite",
    fetchFields: ["isFavorite"],
    headerName: "",
    width: 60,
    resizable: false,
    sortable: true,
    filterable: false,
    align: "center",
    headerAlign: "center",
    renderCell: (params: GridRenderCellParams) => (
      <FavoriteButton
        componentId={String(params.row.id)}
        componentType="executor"
        ariaLabel="Toggle executor favorite"
        format="table"
        isFavorite={params.row.isFavorite}
      />
    ),
  },
  {
    field: "name",
    headerName: "Name",
    fetchFields: ["name", "entityName"],
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
    field: "sourceCode",
    headerName: "Code Repository",
    flex: 1,
    sortField: "source_code.source_code_url",
    filter: {
      field: "source_code_id",
      label: "Code Repository",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "sourceCodes",
        labelField: "identifier",
      }),
    },
    valueGetter: (_value: any, row: any) => row.sourceCode?.identifier || "",
    renderCell: (params: GridRenderCellParams) => {
      const sourceCodeVersion = params.row.sourceCode;
      return (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            minWidth: 0,
            overflow: "hidden",
            height: "100%",
          }}
        >
          <ProviderIcon provider={sourceCodeVersion?.sourceCodeProvider} />
          <GetEntityLink
            {...sourceCodeVersion}
            name={getRepoNameFromUrl(params.row.sourceCode?.sourceCodeUrl)}
            noWrap
          />
        </Stack>
      );
    },
  },
  {
    field: "state",
    fetchFields: ["state", "status"],
    headerName: "State",
    flex: 1,
    filter: [
      {
        field: "state",
        operators: ["eq", "in"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Provision", value: ENTITY_STATE.PROVISION },
          { label: "Provisioned", value: ENTITY_STATE.PROVISIONED },
          { label: "Destroy", value: ENTITY_STATE.DESTROY },
          { label: "Destroyed", value: ENTITY_STATE.DESTROYED },
          { label: "Update", value: ENTITY_STATE.UPDATE },
        ],
      },
      {
        field: "status",
        label: "Status",
        operators: ["eq", "in"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Queued", value: ENTITY_STATUS.QUEUED },
          { label: "In Progress", value: ENTITY_STATUS.IN_PROGRESS },
          { label: "Done", value: ENTITY_STATUS.DONE },
          { label: "Error", value: ENTITY_STATUS.ERROR },
          { label: "Unknown", value: ENTITY_STATUS.UNKNOWN },
          { label: "Approval Pending", value: ENTITY_STATUS.APPROVAL_PENDING },
          { label: "Pending", value: ENTITY_STATUS.PENDING },
          { label: "Rejected", value: ENTITY_STATUS.REJECTED },
          { label: "Ready", value: ENTITY_STATUS.READY },
        ],
      },
    ],
    valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip
        status={String(params.row.status).toLowerCase()}
        state={String(params.row.state).toLowerCase()}
      />
    ),
  },
  ...createdUpdatedColumns(),
  labelsColumn("executor"),
  {
    field: "creator",
    headerName: "Creator",
    flex: 1,
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
    renderCell: (params: GridRenderCellParams) =>
      params.row.creator ? <GetEntityLink {...params.row.creator} /> : null,
  },
];
