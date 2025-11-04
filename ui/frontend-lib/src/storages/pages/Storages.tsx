import { useState, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Button, Box } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
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

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
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
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Storages"
      actions={
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate(`${linkPrefix}storages/create`)}
        >
          Create
        </Button>
      }
    >
      <EntityFetchTable
        title="Storages"
        entityName="storage"
        columns={columns}
        filters={labels}
        filterName="labels"
        filterOperator="__contains_all"
        searchName="name"
      />
    </PageContainer>
  );
};

StoragesPage.path = "/storages";
