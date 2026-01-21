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

export const ResourcesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [labels, setLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);

  useEffect(() => {
    // Load labels
    ikApi.get("labels/resource").then((response: string[]) => {
      setLabels(response);
    });

    // Load templates
    ikApi
      .getList("templates", {
        pagination: { page: 1, perPage: 1000 },
        fields: ["id", "name"],
        sort: { field: "name", order: "ASC" },
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
        field: "name",
        headerName: "Name",
        flex: 1,
        hideable: false,
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

  // Custom API filter builder for Resources
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

    // Handle template filter - map template names to template IDs
    if (filterValues.template && filterValues.template.length > 0) {
      apiFilters["template__name__in"] = filterValues.template;
    }

    return apiFilters;
  };

  return (
    <PageContainer
      title="Resources"
      actions={
        <PermissionWrapper
          requiredPermission="api:resource"
          permissionAction="read"
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}resources/create`)}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Resources"
        entityName="resource"
        columns={columns}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
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
      />
    </PageContainer>
  );
};

ResourcesPage.path = "/resources";
