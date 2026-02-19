import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const ExecutorsPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    // Load labels
    ikApi.get("labels/executor").then((response: string[]) => {
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
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "source_code_id",
        headerName: "Source Code",
        flex: 1,
        valueGetter: (value: any, row: any) =>
          row.source_code_version?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCodeVersion = params.row.source_code;
          return <GetEntityLink {...sourceCodeVersion} />;
        },
      },
      {
        field: "state",
        headerName: "State",
        flex: 1,
        valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip
            status={String(params.row.status).toLowerCase()}
            state={String(params.row.state).toLowerCase()}
            updatedAt={params.row.updated_at}
          />
        ),
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  // Configure filters using the new FilterConfig system
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

  // Custom API filter builder for Executors
  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    // Handle name search
    if (filterValues.name && filterValues.name.trim().length > 0) {
      apiFilters["name__like"] = filterValues.name;
    }

    // Handle labels filter
    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    return apiFilters;
  };

  return (
    <PageContainer
      title="Executors"
      actions={
        <PermissionWrapper
          requiredPermission="api:executor"
          permissionAction="read"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}executors/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Executors"
        entityName="executor"
        columns={columns}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        fields={[
          "id",
          "name",
          "source_code",
          "state",
          "status",
          "created_at",
          "updated_at",
          "labels",
        ]}
      />
    </PageContainer>
  );
};

ExecutorsPage.path = "/executors";
