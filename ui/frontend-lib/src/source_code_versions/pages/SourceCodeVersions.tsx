import { useState, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const SourceCodeVersionsPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const navigate = useNavigate();

  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/source_code_version").then((response: string[]) => {
      setLabels(response);
    });
  }, [ikApi]);

  const columns = useMemo(
    () => [
      {
        field: "identifier",
        headerName: "Name",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "template",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.identifier || value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return GetReferenceUrlValue(template);
        },
      },
      {
        field: "source_code",
        headerName: "Code Repository",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          const sourceCode = params.row.source_code;
          return GetReferenceUrlValue(sourceCode);
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
      title="Code Versions"
      actions={
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate(`${linkPrefix}source_code_versions/create`)}
        >
          Create
        </Button>
      }
    >
      <EntityFetchTable
        title="Code Versions"
        entityName="source_code_version"
        columns={columns}
        filters={labels}
        fields={[
          "id",
          "identifier",
          "template",
          "source_code",
          "status",
          "created_at",
        ]}
        filterName="labels"
        filterOperator="__contains_all"
      />
    </PageContainer>
  );
};

SourceCodeVersionsPage.path = "/source_code_versions";
