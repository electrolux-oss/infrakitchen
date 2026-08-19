import { Box } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { Labels } from "../../common/components/Labels";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATE, ENTITY_STATUS } from "../../utils/constants";

export const storageColumns: EntityTableColumn[] = [
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
    field: "storageType",
    headerName: "Type",
    flex: 1,
    filter: {
      field: "storage_type",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [{ label: "Tofu", value: "tofu" }],
    },
  },
  {
    field: "storageProvider",
    headerName: "Provider",
    flex: 1,
    filter: {
      field: "storage_provider",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "GitHub", value: "github" },
        { label: "Bitbucket", value: "bitbucket" },
        { label: "Azure DevOps", value: "azure_devops" },
      ],
    },
    renderCell: (params: GridRenderCellParams) => (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: "100%",
        }}
      >
        {getProviderValue(params.value)}
      </Box>
    ),
  },
  {
    field: "state",
    fetchFields: ["state", "status"],
    headerName: "State",
    flex: 1,
    filter: [
      {
        field: "state",
        label: "State",
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
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip
        status={String(params.row.status).toLowerCase()}
        state={String(params.row.state).toLowerCase()}
      />
    ),
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
    renderCell: (params: GridRenderCellParams) =>
      params.row.creator ? <GetEntityLink {...params.row.creator} /> : null,
  },
  {
    field: "integration",
    headerName: "Integration",
    flex: 1,
    sortField: "integration.name",
    filter: {
      field: "integration_id",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "integrations",
        labelField: "name",
      }),
    },
    valueGetter: (_value: any, row: any) => row.integration?.name || "",
    renderCell: (params: GridRenderCellParams) =>
      params.row.integration ? (
        <GetEntityLink {...params.row.integration} />
      ) : null,
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
      labelsEntity: "storage",
    },
    valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
    renderCell: (params: GridRenderCellParams) => (
      <Labels labels={params.row.labels || []} />
    ),
  },
];

export const storageDefaultColumnVisibilityModel = {
  updatedAt: false,
  description: false,
  revisionNumber: false,
  creator: false,
  integration: false,
  labels: false,
};
