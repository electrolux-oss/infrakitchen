import { useCallback, useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { STORAGE_FIELD_MAP } from "../graphql/fragments";

interface EntityStoragesProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

const columns = [
  {
    field: "name",
    fetchFields: ["name", "id", "entityName"],
    headerName: "Name",
    flex: 1,
    hideable: false,
    renderCell: (params: GridRenderCellParams) => {
      return <GetEntityLink {...params.row} />;
    },
  },
  {
    field: "storageType",
    headerName: "Type",
    flex: 1,
  },
  {
    field: "storageProvider",
    headerName: "Provider",
    flex: 1,
    renderCell: (params: GridRenderCellParams) =>
      getProviderValue(params.value),
  },
  {
    field: "state",
    fetchFields: ["state", "status"],
    headerName: "State",
    flex: 1,
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
    field: "creator",
    headerName: "Creator",
    flex: 1,
    valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
    renderCell: (params: GridRenderCellParams) =>
      params.row.creator ? <GetEntityLink {...params.row.creator} /> : null,
  },
];

export const EntityStorages = ({
  fixedFilters,
  filterStorageKey,
}: EntityStoragesProps) => {
  const filterConfigs: FilterConfig[] = useMemo(
    () => [{ id: "name", type: "search", label: "Search", width: 420 }],
    [],
  );

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => {
      const apiFilters: Record<string, any> = {};
      if (filterValues.name && filterValues.name.trim().length > 0) {
        apiFilters.name__like = filterValues.name;
      }
      return { ...apiFilters, ...fixedFilters };
    },
    [fixedFilters],
  );

  return (
    <EntityFetchTable
      title="Storages"
      entityName="storage"
      entityFieldMap={STORAGE_FIELD_MAP}
      columns={columns}
      filterStorageKey={filterStorageKey}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
    />
  );
};
