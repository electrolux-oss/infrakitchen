import { Box } from "@mui/material";
import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { Labels } from "../../common/components/Labels";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATUS } from "../../utils/constants";

export const secretColumns: EntityTableColumn[] = [
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
    },
    renderCell: (params: GridRenderCellParams) => {
      return <GetEntityLink {...params.row} />;
    },
  },
  {
    field: "description",
    headerName: "Description",
    flex: 1,
    filter: {
      field: "description",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
    },
  },
  {
    field: "secretType",
    headerName: "Type",
    flex: 1,
  },
  {
    field: "secretProvider",
    headerName: "Provider",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <Box display="flex" alignItems="center" height="100%">
        {getProviderValue(params.value)}
      </Box>
    ),
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
      return <GetEntityLink {...creator} />;
    },
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
      labelsEntity: "secret",
    },
    valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
    renderCell: (params: GridRenderCellParams) => (
      <Labels labels={params.row.labels || []} />
    ),
  },
];

export const secretDefaultColumnVisibilityModel: GridColumnVisibilityModel = {
  description: false,
  updatedAt: false,
  integration: false,
  labels: false,
};
