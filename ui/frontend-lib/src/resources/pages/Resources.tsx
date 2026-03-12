import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useLocation } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { SourceCodeVersionLink } from "../../source_codes/components/SourceCodeVersionLink";
import { SourceCodeVersionResponse } from "../../source_codes/types";

export const ResourcesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const [labels, setLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [allSourceCodeVersions, setAllSourceCodeVersions] = useState<
    SourceCodeVersionResponse[]
  >([]);

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
        setTemplates(response.data);
      })
      .catch((_) => {
        setTemplates([]);
      });

    // Load SCV
    ikApi
      .getList("source_code_versions", {
        pagination: { page: 1, perPage: 1000 },
        fields: ["id", "source_code_version", "source_code_branch", "template"],
      })
      .then((response: any) => {
        setAllSourceCodeVersions(response.data);
      })
      .catch((_) => {
        setAllSourceCodeVersions([]);
      });
  }, [ikApi]);

  const cascadingOptions = useMemo(() => {
    return templates.map((t) => {
      const versions = allSourceCodeVersions.filter(
        (scv) => scv.template.id === t.id,
      );

      return {
        label: t.name,
        value: `template:${t.id}`,
        children:
          versions.length > 0
            ? [
                ...versions.map((scv) => ({
                  label: scv.source_code_version ?? scv.source_code_branch,
                  value: `scv:${scv.id}:${t.id}`,
                })),
              ].sort((a, b) => a.label.localeCompare(b.label))
            : undefined,
      };
    });
  }, [templates, allSourceCodeVersions]);

  const initialFilter = location.state?.filters;

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
        field: "Favorite",
        headerName: "",
        width: 60,
        sortable: true,
        filterable: false,
        align: "center" as const,
        headerAlign: "center" as const,
        renderCell: (params: GridRenderCellParams) => (
          <FavoriteButton
            componentId={String(params.row.id)}
            componentType="resource"
            ariaLabel="Toggle resource favorite"
            format="table"
          />
        ),
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
        headerName: "Template Version",
        flex: 1,
        valueGetter: (value: any, row: any) => {
          const scv = row.source_code_version;
          if (!scv) return "";
          return scv.source_code_version ?? scv.source_code_branch;
        },
        renderCell: (params: GridRenderCellParams) => {
          const scv = params.row.source_code_version;
          if (!scv) return null;
          const ref = scv.source_code_version ?? scv.source_code_branch;
          return <SourceCodeVersionLink source_code_version={scv} name={ref} />;
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
      {
        field: "updated_at",
        headerName: "Updated At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  // Configure filters using the new FilterConfig system
  const filterConfigs: FilterConfig[] = useMemo(() => {
    return [
      {
        id: "template_version",
        type: "cascading" as const,
        label: "Template & Version",
        options: cascadingOptions,
        width: 420,
      },
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
    ];
  }, [labels, cascadingOptions]);

  // Custom API filter builder for Resources
  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    // Handle name search
    if (filterValues.name && filterValues.name.trim().length > 0) {
      apiFilters["name__like"] = filterValues.name;
    }

    // Handle labels filter
    if (filterValues.labels && filterValues.labels.length > 0) {
      apiFilters["labels__contains_all"] = filterValues.labels;
    }

    // Handle Cascading Filter
    if (filterValues.template_version) {
      const val = filterValues.template_version as string;
      if (val.startsWith("template:")) {
        apiFilters["template_id"] = val.replace("template:", "");
      } else if (val.startsWith("scv:")) {
        const parts = val.split(":");
        apiFilters["source_code_version_id"] = parts[1];
        apiFilters["template_id"] = parts[2];
      }
    }

    return apiFilters;
  }, []);

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
        initialFilters={initialFilter}
        buildApiFilters={buildApiFilters}
        fields={[
          "id",
          "name",
          "template",
          "source_code_version",
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

ResourcesPage.path = "/resources";
