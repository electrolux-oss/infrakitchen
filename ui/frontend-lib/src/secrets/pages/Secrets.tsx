import { useEffect, useMemo, useState } from "react";

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
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const SecretsPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const navigate = useNavigate();

  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/secret").then((response: string[]) => {
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
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "secret_type",
        headerName: "Type",
        flex: 1,
      },
      {
        field: "secret_provider",
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
    ],
    [],
  );

  return (
    <PageContainer
      title="Secrets"
      actions={
        <PermissionWrapper
          requiredPermission="api:secret"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}secrets/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Secrets"
        entityName="secret"
        columns={columns}
        fields={[
          "id",
          "name",
          "status",
          "state",
          "secret_provider",
          "secret_type",
          "created_at",
          "updated_at",
          "labels",
        ]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

SecretsPage.path = "/secrets";
