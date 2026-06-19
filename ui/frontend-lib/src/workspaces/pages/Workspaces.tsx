import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Box, Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import {
  FilterConfig,
  Labels,
  PermissionWrapper,
  useConfig,
} from "../../common";
import {
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { WORKSPACE_FIELD_MAP } from "../graphql/fragments";

export const WorkspacesPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const navigate = useNavigate();

  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi
      .graphqlRequest<{ labels: string[] }>(
        `query WorkspaceLabels {
          labels: labels(entity: "workspace")
        }`,
      )
      .then((response) => {
        setLabels(response.labels || []);
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
  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.name && filterValues.name.trim().length > 0) {
      apiFilters["name__like"] = filterValues.name;
    }

    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    return apiFilters;
  };

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["id", "name", "entityName"],
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "workspaceProvider",
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
        fetchFields: ["status"],
        headerName: "State",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={String(params.row.status).toLowerCase()} />
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
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return <GetEntityLink {...creator} name={creator.identifier} />;
        },
      },
      {
        field: "integration",
        headerName: "Integration",
        flex: 1,
        sortField: "integration.name",
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
      title="Workspaces"
      actions={
        <PermissionWrapper
          requiredPermission="api:workspace"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}workspaces/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Workspaces"
        entityName="workspace"
        columns={columns}
        entityFieldMap={WORKSPACE_FIELD_MAP}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

WorkspacesPage.path = "/workspaces";
