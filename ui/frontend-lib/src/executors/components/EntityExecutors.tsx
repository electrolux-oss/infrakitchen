import { useCallback, useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, getRepoNameFromUrl } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { transformExecutorOptional } from "../graphql";
import { EXECUTOR_FIELD_MAP } from "../graphql/fragments";

interface EntityExecutorsProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

const columns = [
  {
    field: "name",
    headerName: "Name",
    flex: 1,
    hideable: false,
    renderCell: (params: GridRenderCellParams) => {
      return <GetEntityLink {...params.row} />;
    },
  },
  {
    field: "source_code",
    headerName: "Code Repository",
    flex: 1,
    sortField: "source_code.source_code_url",
    valueGetter: (_value: any, row: any) => row.source_code?.identifier || "",
    renderCell: (params: GridRenderCellParams) => {
      const sourceCode = params.row.source_code;
      if (!sourceCode) return null;
      return (
        <GetEntityLink
          {...sourceCode}
          name={getRepoNameFromUrl(sourceCode.sourceCodeUrl)}
        />
      );
    },
  },
  {
    field: "state",
    fetchFields: ["state", "status"],
    headerName: "State",
    flex: 1,
    valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip
        status={String(params.row.status).toLowerCase()}
        state={String(params.row.state).toLowerCase()}
      />
    ),
  },
  {
    field: "created_at",
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

export const EntityExecutors = ({
  fixedFilters,
  filterStorageKey,
}: EntityExecutorsProps) => {
  const filterConfigs: FilterConfig[] = useMemo(
    () => [{ id: "name", type: "search", label: "Search", width: 420 }],
    [],
  );

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => {
      const apiFilters: Record<string, any> = {};
      if (filterValues.name && filterValues.name.trim().length > 0) {
        apiFilters["name__like"] = filterValues.name;
      }
      return { ...apiFilters, ...fixedFilters };
    },
    [fixedFilters],
  );

  return (
    <EntityFetchTable
      title="Executors"
      entityName="executor"
      transformFn={transformExecutorOptional}
      entityFieldMap={EXECUTOR_FIELD_MAP}
      columns={columns}
      filterStorageKey={filterStorageKey}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
    />
  );
};
