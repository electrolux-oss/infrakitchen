import { useMemo } from "react";

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

export const BatchOperationsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

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
        field: "entity_type",
        headerName: "Entity",
        flex: 0.5,
      },
      {
        field: "entity_ids",
        headerName: "# of Entities",
        flex: 0.5,
        valueGetter: (value: any) => (value ? value.length : 0),
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

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "name",
        type: "search" as const,
        label: "Search",
        width: 420,
      },
    ],
    [],
  );

  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.name && filterValues.name.trim().length > 0) {
      apiFilters["name__like"] = filterValues.name;
    }

    return apiFilters;
  };

  return (
    <PageContainer
      title="Batch Operations"
      actions={
        <PermissionWrapper
          requiredPermission="api:batch_operation"
          permissionAction="read"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}batch_operations/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Batch Operations"
        entityName="batch_operation"
        columns={columns}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        fields={["id", "name", "entity_type", "entity_ids", "created_at"]}
      />
    </PageContainer>
  );
};

BatchOperationsPage.path = "/batch_operations";
