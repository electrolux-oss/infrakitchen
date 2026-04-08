import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { FilterConfig } from "../../common";
import { GetEntityLink, getLabels } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/EntityTable";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { IntegrationShort } from "../../integrations/types";
import { SecretShort } from "../../secrets/types";
import { SourceCodeVersionLink } from "../../source_codes/components/SourceCodeVersionLink";
import { ResourceShort } from "../types";

export const resourceFields = [
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
];

export const resourceDefaultColumnVisibilityModel: GridColumnVisibilityModel = {
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
};

export const resourceColumns: EntityTableColumn[] = [
  {
    field: "Favorite",
    fetchFields: [],
    headerName: "",
    width: 60,
    resizable: false,
    sortable: true,
    filterable: false,
    align: "center",
    headerAlign: "center",
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
    field: "name",
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
    valueGetter: (_value: any, row: any) => {
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
    fetchFields: ["state", "status"],
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
    headerName: "Created",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <RelativeTime
        date={params.value}
        sx={{ fontSize: "0.75rem", display: "flex" }}
      />
    ),
  },
  {
    field: "updated_at",
    headerName: "Last Updated",
    flex: 1,
    renderCell: (params: GridRenderCellParams) => (
      <RelativeTime
        date={params.value}
        sx={{ fontSize: "0.75rem", display: "flex" }}
      />
    ),
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
      const integrations: IntegrationShort[] = params.row.integration_ids || [];
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
];

export const buildResourceApiFilters = (
  filterValues: Record<string, any>,
  forcedTemplateId?: string,
): Record<string, any> => {
  const apiFilters: Record<string, any> = {};

  if (forcedTemplateId) {
    apiFilters.template_id = forcedTemplateId;
  }

  if (filterValues.name && filterValues.name.trim().length > 0) {
    apiFilters.name__like = filterValues.name;
  }

  if (filterValues.labels && filterValues.labels.length > 0) {
    apiFilters.labels__contains_all = filterValues.labels;
  }

  if (filterValues.source_code_version_id) {
    apiFilters.source_code_version_id = filterValues.source_code_version_id;
  }

  if (filterValues.template_version) {
    const selection = filterValues.template_version;

    const stripPrefix = (val: any) => {
      if (typeof val !== "string") return val;
      if (val.startsWith("template:")) return val.replace("template:", "");
      if (val.startsWith("scv:")) return val.split(":")[1];
      return val;
    };

    if (Array.isArray(selection)) {
      const [t, v] = selection;
      if (t) apiFilters.template_id = stripPrefix(t);
      if (v) apiFilters.source_code_version_id = stripPrefix(v);
    } else {
      apiFilters.template_id = stripPrefix(selection);
    }
  }

  return apiFilters;
};

interface ResourceFilterConfigProps {
  labels: string[];
  loadTemplateOptions?: (
    search: string,
    page: number,
  ) => Promise<{
    options: Array<{
      label: string;
      value: string;
      loadChildren?: (
        parentValue: string,
      ) => Promise<Array<{ label: string; value: string }>>;
    }>;
    hasMore: boolean;
  }>;
  versionOptions?: string[];
  showTemplateVersionFilter: boolean;
}

export const createResourceFilterConfigs = ({
  labels,
  loadTemplateOptions,
  versionOptions = [] as string[],
  showTemplateVersionFilter,
}: ResourceFilterConfigProps): FilterConfig[] => {
  const primaryFilter: FilterConfig = showTemplateVersionFilter
    ? {
        id: "template_version",
        type: "cascading",
        label: "Template & Version",
        loadOptions: loadTemplateOptions,
        width: 420,
      }
    : {
        id: "source_code_version_id",
        type: "autocomplete",
        label: "Version",
        options: versionOptions,
        multiple: false,
        disableCloseOnSelect: false,
        width: 420,
      };

  return [
    primaryFilter,
    {
      id: "name",
      type: "search",
      label: "Search",
      width: 420,
    },
    {
      id: "labels",
      type: "autocomplete",
      label: "Labels",
      options: labels,
      multiple: true,
      width: 420,
    },
  ];
};
