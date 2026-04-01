import { useCallback, useEffect, useMemo, useState } from "react";

import { Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";

interface IntegrationWorkspaceDependenciesProps {
  integration_id: string;
}

export const IntegrationWorkspaceDependencies = (
  props: IntegrationWorkspaceDependenciesProps,
) => {
  const { integration_id } = props;
  const { ikApi } = useConfig();
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/workspace").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <GetEntityLink {...params.row} />
        ),
      },
      {
        field: "state",
        fetchFields: ["status"],
        headerName: "State",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={String(params.row.status).toLowerCase()} />
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
        field: "link",
        headerName: "Link",
        flex: 2,
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
    link: false,
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
        apiFilters.name__like = filterValues.name;
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
      title="Workspaces"
      entityName="workspace"
      columns={columns}
      defaultColumnVisibilityModel={defaultColumnVisibilityModel}
      filterConfigs={filterConfigs}
      buildApiFilters={buildApiFilters}
      fields={[
        "id",
        "name",
        "status",
        "updated_at",
        "created_at",
        "labels",
        "description",
        "link",
      ]}
    />
  );
};
