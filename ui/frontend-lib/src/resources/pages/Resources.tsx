import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useLocation } from "react-router";

import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig, PermissionWrapper } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  getLabels,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { IntegrationShort } from "../../integrations/types";
import { SecretShort } from "../../secrets/types";
import { SourceCodeVersionLink } from "../../source_codes/components/SourceCodeVersionLink";
import { ResourceShort } from "../types";

export const ResourcesPage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const [labels, setLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>(
    [],
  );

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
  }, [ikApi]);

  const cascadingOptions = useMemo(() => {
    return templates.map((template) => {
      return {
        label: template.name,
        value: `template:${template.id}`,
        loadChildren: async (parentValue: string) => {
          const templateId = parentValue.replace("template:", "");
          try {
            const response = await ikApi.getList("source_code_versions", {
              filter: { template_id: templateId },
              pagination: { page: 1, perPage: 1000 },
              fields: ["id", "source_code_version", "source_code_branch"],
            });
            return response.data
              .map((version: any) => ({
                label:
                  version.source_code_version ?? version.source_code_branch,
                value: `scv:${version.id}:${templateId}`,
              }))
              .sort((a: any, b: any) => a.label.localeCompare(b.label));
          } catch {
            notifyError("Failed to load options");
            return [];
          }
        },
      };
    });
  }, [templates, ikApi]);

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
        resizable: false,
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
        field: "template",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return <GetEntityLink {...template} />;
        },
      },
      {
        field: "source_code_version",
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
      {
        field: "creator",
        headerName: "Creator",
        flex: 1,
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return <GetEntityLink {...creator} name={creator.identifier} />;
        },
      },
      {
        field: "storage",
        headerName: "Storage",
        flex: 1,
        valueGetter: (_value: any, row: any) => row.storage?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const storage = params.row.storage;
          if (!storage) return null;
          return <GetEntityLink {...storage} />;
        },
      },
      {
        field: "workspace",
        headerName: "Workspace",
        flex: 1,
        valueGetter: (_value: any, row: any) => row.workspace?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const workspace = params.row.workspace;
          if (!workspace) return null;
          return <GetEntityLink {...workspace} />;
        },
      },
      {
        field: "integration_ids",
        headerName: "Integrations",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.integration_ids || [])
            .map((i: IntegrationShort) => i.name)
            .join(", "),
        renderCell: (params: GridRenderCellParams) => {
          const integrations: IntegrationShort[] =
            params.row.integration_ids || [];
          if (integrations.length === 0) return null;
          return (
            <span>
              {integrations.map((integration, index) => (
                <span key={integration.id}>
                  <GetEntityLink {...integration} />
                  {index < integrations.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        field: "secret_ids",
        headerName: "Secrets",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.secret_ids || []).map((s: SecretShort) => s.name).join(", "),
        renderCell: (params: GridRenderCellParams) => {
          const secrets: SecretShort[] = params.row.secret_ids || [];
          if (secrets.length === 0) return null;
          return (
            <span>
              {secrets.map((secret, index) => (
                <span key={secret.id}>
                  <GetEntityLink {...secret} />
                  {index < secrets.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        field: "parents",
        headerName: "Parents",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.parents || []).map((p: ResourceShort) => p.name).join(", "),
        renderCell: (params: GridRenderCellParams) => {
          const parents: ResourceShort[] = params.row.parents || [];
          if (parents.length === 0) return null;
          return (
            <span>
              {parents.map((parent, index) => (
                <span key={parent.id}>
                  <GetEntityLink {...parent} />
                  {index < parents.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        field: "children",
        headerName: "Children",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.children || []).map((c: ResourceShort) => c.name).join(", "),
        renderCell: (params: GridRenderCellParams) => {
          const children: ResourceShort[] = params.row.children || [];
          if (children.length === 0) return null;
          return (
            <span>
              {children.map((child, index) => (
                <span key={child.id}>
                  <GetEntityLink {...child} />
                  {index < children.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        field: "variables",
        headerName: "Variables",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.variables || []).map((v: { name: string }) => v.name).join(", "),
        renderCell: (params: GridRenderCellParams) =>
          (params.row.variables || [])
            .map((v: { name: string }) => v.name)
            .join(", ") || null,
      },
      {
        field: "outputs",
        headerName: "Outputs",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.outputs || []).map((o: { name: string }) => o.name).join(", "),
        renderCell: (params: GridRenderCellParams) =>
          (params.row.outputs || [])
            .map((o: { name: string }) => o.name)
            .join(", ") || null,
      },
      {
        field: "labels",
        headerName: "Labels",
        flex: 1,
        valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
        renderCell: (params: GridRenderCellParams) =>
          getLabels(params.row.labels || []),
      },
      {
        field: "dependency_tags",
        headerName: "Dependency Tags",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.dependency_tags || [])
            .map(
              (tag: { name: string; value: unknown }) =>
                `${tag.name}:${String(tag.value ?? "")}`,
            )
            .join(", "),
        renderCell: (params: GridRenderCellParams) =>
          (params.row.dependency_tags || [])
            .map(
              (tag: { name: string; value: unknown }) =>
                `${tag.name}:${String(tag.value ?? "")}`,
            )
            .join(", ") || null,
      },
      {
        field: "dependency_config",
        headerName: "Dependency Config",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          (row.dependency_config || [])
            .map(
              (cfg: { name: string; value: unknown }) =>
                `${cfg.name}:${String(cfg.value ?? "")}`,
            )
            .join(", "),
        renderCell: (params: GridRenderCellParams) =>
          (params.row.dependency_config || [])
            .map(
              (cfg: { name: string; value: unknown }) =>
                `${cfg.name}:${String(cfg.value ?? "")}`,
            )
            .join(", ") || null,
      },
    ],
    [],
  );

  const defaultColumnVisibilityModel = useMemo(
    () => ({
      creator: false,
      storage: false,
      workspace: false,
      integration_ids: false,
      secret_ids: false,
      parents: false,
      children: false,
      variables: false,
      outputs: false,
      labels: false,
      dependency_tags: false,
      dependency_config: false,
    }),
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
      const selection = filterValues.template_version;

      const stripPrefix = (val: any) => {
        if (typeof val !== "string") return val;
        if (val.startsWith("template:")) return val.replace("template:", "");
        if (val.startsWith("scv:")) return val.split(":")[1];
        return val;
      };

      if (Array.isArray(selection)) {
        // Path provided: [template, version]
        const [t, v] = selection;
        if (t) apiFilters["template_id"] = stripPrefix(t);
        if (v) apiFilters["source_code_version_id"] = stripPrefix(v);
      } else {
        // Single value
        const val = stripPrefix(selection);
        apiFilters["template_id"] = val;
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
        defaultColumnVisibilityModel={defaultColumnVisibilityModel}
        filterConfigs={filterConfigs}
        initialFilters={initialFilter}
        buildApiFilters={buildApiFilters}
        fields={[
          "id",
          "name",
          "description",
          "abstract",
          "revision_number",
          "creator",
          "template",
          "source_code_version",
          "integration_ids",
          "secret_ids",
          "storage",
          "storage_path",
          "variables",
          "outputs",
          "dependency_tags",
          "dependency_config",
          "parents",
          "children",
          "state",
          "status",
          "created_at",
          "updated_at",
          "labels",
          "workspace",
        ]}
      />
    </PageContainer>
  );
};

ResourcesPage.path = "/resources";
