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
import { transformSourceCodeVersionOptional } from "../graphql";
import { SCV_FIELD_MAP } from "../graphql/fragments";

export const SourceCodeVersionsPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const navigate = useNavigate();

  const [labels, setLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);

  useEffect(() => {
    ikApi
      .graphqlRequest<{ templates: { name: string }[]; labels: string[] }>(
        `
  query Filters($filter: JSON, $sort: [String!], $range: [Int!]) {
    templates(filter: $filter, sort: $sort, range: $range) {
      name
    }
    labels: labels(entity: "template")
  }
`,
        {
          filter: { abstract: false },
          sort: ["name", "ASC"],
          range: [0, 1000],
        },
      )
      .then((response: any) => {
        const templateNames = (response.templates || []).map(
          (t: any) => t.name,
        );
        setTemplates(templateNames);
        setLabels(response.labels || []);
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
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "template",
        headerName: "Template",
        flex: 1,
        sortField: "template.name",
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return <GetEntityLink {...template} />;
        },
      },
      {
        field: "source_code",
        headerName: "Code Repository",
        flex: 1,
        sortField: "source_code.source_code_url",
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCode = params.row.source_code;
          return (
            <GetEntityLink
              {...sourceCode}
              identifier={sourceCode.sourceCodeUrl}
            />
          );
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
      title="Template Versions"
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
        entityName="sourceCodeVersion"
        columns={columns}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
        entityFieldMap={SCV_FIELD_MAP}
        transformFn={transformSourceCodeVersionOptional}
      />
    </PageContainer>
  );
};

SourceCodeVersionsPage.path = "/source_code_versions";
