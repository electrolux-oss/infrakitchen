import { NavigateFunction } from "react-router";

import { Link } from "@mui/material";
import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";

export const taskDefaultColumnVisibilityModel: GridColumnVisibilityModel = {
  creator: false,
};

export const taskColumns = (options: {
  navigate: NavigateFunction;
  linkPrefix: string;
  entityOptions: string[];
}): EntityTableColumn[] => [
  {
    field: "entity",
    fetchFields: ["entity", "entityId", "entityData"],
    headerName: "Entity",
    flex: 1,
    hideable: false,
    filter: {
      field: "entity",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      optionsKey: "entities",
    },
    renderCell: (params: GridRenderCellParams) => {
      return (
        <Link
          onClick={() => {
            options.navigate(
              `${options.linkPrefix}${params.row.entity}s/${params.row.entityId}`,
            );
          }}
          rel="noopener"
          style={{ cursor: "pointer" }}
        >
          {params.row.entityData?.name ?? params.row.entity}
        </Link>
      );
    },
  },
  {
    field: "status",
    fetchFields: ["status", "state"],
    headerName: "Status",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={params.row.status} state={params.row.state} />
    ),
  },
  {
    field: "createdAt",
    headerName: "Created",
    sortField: "created_at",
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
    sortField: "updated_at",
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
];
