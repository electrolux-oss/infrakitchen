import { useCallback, useMemo } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import StatusChip from "../../common/StatusChip";
import { SCV_FIELD_MAP } from "../graphql/fragments";

interface EntitySourceCodeVersionsProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

const columns = [
  {
    field: "identifier",
    fetchFields: ["id", "identifier", "entityName"],
    headerName: "Name",
    flex: 1,
    hideable: false,
    renderCell: (params: GridRenderCellParams) => {
      return <GetEntityLink {...params.row} />;
    },
  },
  {
    field: "sourceCode",
    headerName: "Code Repository",
    flex: 1,
    sortField: "source_code.source_code_url",
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const sourceCode = params.row.sourceCode;
      if (!sourceCode) return null;
      return (
        <GetEntityLink {...sourceCode} identifier={sourceCode.sourceCodeUrl} />
      );
    },
  },
  {
    field: "status",
    headerName: "Status",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={params.row.status} />
    ),
  },
  {
    field: "createdAt",
    headerName: "Created At",
    flex: 1,
    renderCell: (params: GridRenderCellParams) =>
      getDateValue(params.row.createdAt),
  },
  {
    field: "creator",
    headerName: "Creator",
    flex: 1,
    sortField: "creator.identifier",
    valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
    renderCell: (params: GridRenderCellParams) => {
      const creator = params.row.creator;
      if (!creator) return null;
      return <GetEntityLink {...creator} />;
    },
  },
];

export const EntitySourceCodeVersions = ({
  fixedFilters,
  filterStorageKey,
}: EntitySourceCodeVersionsProps) => {
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "source_code_folder",
        type: "search" as const,
        label: "Folder Name",
        width: 420,
      },
    ],
    [],
  );

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => ({
      ...(filterValues.source_code_folder &&
      filterValues.source_code_folder.trim().length > 0
        ? { source_code_folder__like: filterValues.source_code_folder }
        : {}),
      ...fixedFilters,
    }),
    [fixedFilters],
  );

  return (
    <EntityFetchTable
      title="Template Versions"
      entityName="sourceCodeVersion"
      columns={columns}
      entityFieldMap={SCV_FIELD_MAP}
      filterStorageKey={filterStorageKey}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
    />
  );
};
