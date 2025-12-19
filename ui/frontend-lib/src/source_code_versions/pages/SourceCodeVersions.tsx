import { useState, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
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
  const [templates, setTemplates] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("labels/source_code_version").then((response: string[]) => {
      setLabels(response);
    });
    // Load templates
    ikApi
      .getList("templates", {
        pagination: { page: 1, perPage: 1000 },
        fields: ["id", "name"],
        sort: { field: "name", order: "ASC" },
        filter: { abstract: false },
      })
      .then((response: any) => {
        const templateNames = response.data.map((t: any) => t.name);
        setTemplates(templateNames);
      })
      .catch((_) => {
        setTemplates([]);
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
          return <GetReferenceUrlValue {...template} />;
        },
      },
      {
        field: "source_code_id",
        headerName: "Code Repository",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          const sourceCode = params.row.source_code;
          return <GetReferenceUrlValue {...sourceCode} />;
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
        id: "source_code_folder",
        type: "search" as const,
        label: "Folder Name",
        width: 420,
      },
      {
        id: "source_code_version",
        type: "search" as const,
        label: "Tag",
        width: 420,
      },
      {
        id: "template",
        type: "autocomplete" as const,
        label: "Template",
        options: templates,
        multiple: true,
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
    [labels, templates],
  );

  // Build API filters
  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    // search by folder name
    if (
      filterValues.source_code_folder &&
      filterValues.source_code_folder.trim().length > 0
    ) {
      apiFilters["source_code_folder__like"] = filterValues.source_code_folder;
    }

    // search by version tag
    if (
      filterValues.source_code_version &&
      filterValues.source_code_version.trim().length > 0
    ) {
      apiFilters["source_code_version__like"] =
        filterValues.source_code_version;
    }

    // Handle template filter - map template names to template IDs
    if (filterValues.template && filterValues.template.length > 0) {
      apiFilters["template__name__in"] = filterValues.template;
    }

    return apiFilters;
  };

  return (
    <PageContainer
      title="Code Versions"
      actions={
        <PermissionWrapper
          requiredPermission="api:source_code_version"
          permissionAction="write"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}source_code_versions/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
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
