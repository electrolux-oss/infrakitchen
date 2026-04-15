import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Box, Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, PermissionWrapper, useConfig } from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { Labels } from "../../common/components/Labels";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const StoragesPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const navigate = useNavigate();

  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/storage").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "name",
        type: "search" as const,
        label: "Search",
        width: 420,
      },
      {
        id: "labels",
        type: "autocomplete" as const,
        label: "Labels",
        options: labels,
        multiple: true,
        width: 420,
      },
    ],
    [labels],
  );

  // Build API filters
  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.name && filterValues.name.trim().length > 0) {
      apiFilters["name__like"] = filterValues.name;
    }

    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    return apiFilters;
  }, []);

  const columns = useMemo(
    () => [
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
        field: "storage_type",
        headerName: "Type",
        flex: 1,
      },
      {
        field: "storage_provider",
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
        flex: 1,
      },
      {
        field: "revision_number",
        headerName: "Revision",
        flex: 1,
      },
      {
        field: "creator",
        headerName: "Creator",
        flex: 1,
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) =>
          params.row.creator ? <GetEntityLink {...params.row.creator} /> : null,
      },
      {
        field: "integration",
        headerName: "Integration",
        flex: 1,
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
        valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
        renderCell: (params: GridRenderCellParams) => (
          <Labels labels={params.row.labels || []} />
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Storages"
      actions={
        <PermissionWrapper
          requiredPermission="api:storage"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}storages/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Storages"
        entityName="storage"
        columns={columns}
        fields={[
          "id",
          "name",
          "status",
          "state",
          "storage_provider",
          "storage_type",
          "created_at",
          "updated_at",
          "labels",
          "creator",
          "integration",
          "description",
          "revision_number",
        ]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        defaultColumnVisibilityModel={{
          updated_at: false,
          description: false,
          revision_number: false,
          creator: false,
          integration: false,
          labels: false,
        }}
      />
    </PageContainer>
  );
};

StoragesPage.path = "/storages";
