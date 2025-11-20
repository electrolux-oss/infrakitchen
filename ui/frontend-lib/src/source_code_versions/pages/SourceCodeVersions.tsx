import { useState, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig } from "../../common";
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
        field: "template_id",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.identifier || value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return GetReferenceUrlValue(template);
        },
      },
      {
        field: "source_code_id",
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

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
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

    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    return apiFilters;
  };

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
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        fields={[
          "id",
          "identifier",
          "template",
          "source_code",
          "status",
          "created_at",
        ]}
      />
    </PageContainer>
  );
};

SourceCodeVersionsPage.path = "/source_code_versions";
