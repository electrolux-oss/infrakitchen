import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const ResourcesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/resource").then((response: string[]) => {
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
        field: "template_id",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return <GetEntityLink {...template} />;
        },
      },
      {
        field: "source_code_version_id",
        headerName: "Source Code Version",
        flex: 1,
        valueGetter: (value: any, row: any) =>
          row.source_code_version?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCodeVersion = params.row.source_code_version;
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
      title="Resources"
      actions={
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate(`${linkPrefix}resources/create`)}
        >
          Create
        </Button>
      }
    >
      <EntityFetchTable
        title="Resources"
        entityName="resource"
        columns={columns}
        filters={labels}
        fields={[
          "id",
          "name",
          "template",
          "source_code_version",
          "state",
          "status",
          "created_at",
          "labels",
        ]}
        filterName="labels"
        filterOperator="__contains_all"
        searchName="name"
      />
    </PageContainer>
  );
};

ResourcesPage.path = "/resources";
