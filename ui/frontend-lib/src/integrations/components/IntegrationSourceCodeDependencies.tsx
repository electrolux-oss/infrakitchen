import { useCallback, useEffect, useMemo, useState } from "react";

import { Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, useConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";

interface IntegrationSourceCodeDependenciesProps {
  integration_id: string;
}

export const IntegrationSourceCodeDependencies = (
  props: IntegrationSourceCodeDependenciesProps,
) => {
  const { integration_id } = props;
  const { ikApi } = useConfig();
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/source_code").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  const columns = useMemo(
    () => [
      {
        field: "source_code_url",
        headerName: "URL",
        flex: 2,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <GetEntityLink {...params.row} name={params.value} />
        ),
      },
      {
        field: "status",
        headerName: "State",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={String(params.value).toLowerCase()} />
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
        field: "updated_at",
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
        field: "description",
        headerName: "Description",
        flex: 2,
      },
      {
        field: "source_code_provider",
        headerName: "Provider",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          params.value ? getProviderValue(params.value) : null,
      },
      {
        field: "source_code_language",
        headerName: "Language",
        flex: 1,
      },
      {
        field: "labels",
        headerName: "Labels",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <>
            {(params.value || []).map((l: string) => (
              <Chip key={l} label={l} size="small" sx={{ mr: 0.5 }} />
            ))}
          </>
        ),
      },
    ],
    [],
  );

  const defaultColumnVisibilityModel = {
    description: false,
    source_code_provider: false,
    source_code_language: false,
  };

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      { id: "name", type: "search", label: "Search", width: 420 },
      {
        id: "labels",
        type: "autocomplete",
        label: "Labels",
        options: labels,
        multiple: true,
        width: 420,
      },
    ],
    [labels],
  );

  const buildApiFilters = useCallback(
    (filterValues: Record<string, any>) => {
      const apiFilters: Record<string, any> = { integration_id };

      if (filterValues.name?.trim()) {
        apiFilters.source_code_url__like = filterValues.name;
      }
      if (filterValues.labels?.length > 0) {
        apiFilters.labels__contains_all = filterValues.labels;
      }

      return apiFilters;
    },
    [integration_id],
  );

  return (
    <EntityFetchTable
      title="Code Repositories"
      entityName="source_code"
      columns={columns}
      defaultColumnVisibilityModel={defaultColumnVisibilityModel}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
      fields={[
        "id",
        "source_code_url",
        "status",
        "updated_at",
        "created_at",
        "labels",
        "description",
        "source_code_provider",
        "source_code_language",
      ]}
    />
  );
};
