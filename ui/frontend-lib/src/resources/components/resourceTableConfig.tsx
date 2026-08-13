import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { Labels } from "../../common/components/Labels";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { getVersionLifecycleStateColor } from "../../common/VersionLifecycleStateChip";
import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlSecretShort } from "../../secrets/graphql";
import {
  ENTITY_STATE,
  ENTITY_STATUS,
  VERSION_LIFECYCLE_STATE,
} from "../../utils/constants";
import { GqlResourceShort } from "../graphql";

// --- Column visibility defaults ---

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
    field: "favorite",
    fetchFields: ["isFavorite"],
    headerName: "",
    width: 60,
    resizable: false,
    sortable: false,
    align: "center",
    headerAlign: "center",
    renderCell: (params: GridRenderCellParams) => (
      <FavoriteButton
        componentId={String(params.row.id)}
        componentType="resource"
        ariaLabel="Toggle resource favorite"
        format="table"
        isFavorite={params.row.isFavorite}
      />
    ),
  },
  {
    field: "name",
    fetchFields: ["name", "entityName"],
    headerName: "Name",
    flex: 1,
    hideable: false,
    filter: {
      field: "name",
      operators: ["like", "eq", "not_like"],
      valueType: "text",
      defaultOperator: "like",
    },
    renderCell: (params: GridRenderCellParams) => {
      return <GetEntityLink {...params.row} />;
    },
  },
  {
    field: "template",
    headerName: "Template",
    flex: 1,
    fetchFields: ["template"],
    sortField: "template.name",
    filter: {
      field: "template_id",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "templates",
        labelField: "name",
        baseFilter: { abstract: false },
      }),
    },
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const template = params.row.template;
      return <GetEntityLink {...template} />;
    },
  },
  {
    field: "project",
    headerName: "Project",
    flex: 1,
    fetchFields: ["project"],
    sortField: "project.name",
    filter: {
      field: "project_id",
      operators: ["eq", "in", "is_none"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "projects",
        labelField: "name",
      }),
    },
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const project = params.row.project;
      return <GetEntityLink {...project} />;
    },
  },
  {
    field: "sourceCodeVersion",
    headerName: "Template Version",
    flex: 1,
    fetchFields: [
      "sourceCodeVersion.sourceCodeVersion",
      "sourceCodeVersion.sourceCodeBranch",
      "sourceCodeVersion.lifecycleState",
      "sourceCodeVersion.breakingChanges",
      "sourceCodeVersion.identifier",
      "sourceCodeVersion.entityName",
      "sourceCodeVersion.id",
    ],
    sortField: "source_code_version.source_code_version",
    filter: [
      {
        field: "source_code_version_id",
        label: "Version",
        operators: ["eq", "in"],
        valueType: "reference",
        defaultOperator: "eq",
        makeReferenceLoader: serverSearchReference({
          entityPlural: "sourceCodeVersions",
          labelField: "identifier",
        }),
      },
      {
        field: "source_code_version__lifecycle_state",
        label: "Version Lifecycle State",
        operators: ["eq", "in"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Unknown", value: VERSION_LIFECYCLE_STATE.UNKNOWN },
          { label: "Preview", value: VERSION_LIFECYCLE_STATE.PREVIEW },
          { label: "Active", value: VERSION_LIFECYCLE_STATE.ACTIVE },
          {
            label: "Deprecated",
            value: VERSION_LIFECYCLE_STATE.DEPRECATED,
          },
          { label: "Archived", value: VERSION_LIFECYCLE_STATE.ARCHIVED },
        ],
      },
    ],
    valueGetter: (_value: any, row: any) => {
      const scv = row.sourceCodeVersion;
      if (!scv) return "";
      return scv.sourceCodeVersion ?? scv.sourceCodeBranch;
    },
    renderCell: (params: GridRenderCellParams) => {
      const scv = params.row.sourceCodeVersion;
      if (!scv) return null;
      const ref = scv.sourceCodeVersion ?? scv.sourceCodeBranch;
      const color = getVersionLifecycleStateColor(scv.lifecycleState);
      const textColor =
        color === "success"
          ? "success.main"
          : color === "info"
            ? "info.main"
            : color === "warning"
              ? "warning.main"
              : color === "error"
                ? "error.main"
                : "text.primary";

      return (
        <GetEntityLink
          {...scv}
          name={ref}
          sx={{
            color: textColor,
            fontWeight: color === "warning" ? 600 : 500,
            textDecorationColor: textColor,
          }}
        />
      );
    },
  },
  {
    field: "state",
    fetchFields: ["state", "status"],
    headerName: "State",
    flex: 1,
    filter: [
      {
        field: "state",
        label: "State",
        operators: ["eq", "in", "not_eq"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Provision", value: ENTITY_STATE.PROVISION },
          { label: "Provisioned", value: ENTITY_STATE.PROVISIONED },
          { label: "Destroy", value: ENTITY_STATE.DESTROY },
          { label: "Destroyed", value: ENTITY_STATE.DESTROYED },
          { label: "Update", value: ENTITY_STATE.UPDATE },
        ],
      },
      {
        field: "status",
        label: "Status",
        operators: ["eq", "in", "not_eq"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Queued", value: ENTITY_STATUS.QUEUED },
          { label: "In Progress", value: ENTITY_STATUS.IN_PROGRESS },
          { label: "Done", value: ENTITY_STATUS.DONE },
          { label: "Error", value: ENTITY_STATUS.ERROR },
          { label: "Unknown", value: ENTITY_STATUS.UNKNOWN },
          { label: "Approval Pending", value: ENTITY_STATUS.APPROVAL_PENDING },
          { label: "Pending", value: ENTITY_STATUS.PENDING },
          { label: "Rejected", value: ENTITY_STATUS.REJECTED },
          { label: "Ready", value: ENTITY_STATUS.READY },
        ],
      },
    ],
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
        date={params.row.createdAt}
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
        date={params.row.updatedAt}
        sx={{ fontSize: "0.75rem", display: "flex" }}
      />
    ),
  },
  {
    field: "creator",
    headerName: "Creator",
    flex: 1,
    sortField: "creator.identifier",
    filter: {
      field: "created_by",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "users",
        labelField: "identifier",
      }),
    },
    valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
    renderCell: (params: GridRenderCellParams) => {
      const creator = params.row.creator;
      if (!creator) return null;
      return <GetEntityLink {...creator} />;
    },
  },
  {
    field: "storage",
    headerName: "Storage",
    flex: 1,
    filter: {
      field: "storage_id",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "storages",
        labelField: "name",
      }),
    },
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
    filter: {
      field: "workspace_id",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "workspaces",
        labelField: "name",
      }),
    },
    valueGetter: (_value: any, row: any) => row.workspace?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const workspace = params.row.workspace;
      if (!workspace) return null;
      return <GetEntityLink {...workspace} />;
    },
  },
  {
    field: "integrationIds",
    headerName: "Integrations",
    flex: 1,
    filter: {
      field: "integration_ids",
      operators: ["any"],
      valueType: "reference",
      defaultOperator: "any",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "integrations",
        labelField: "name",
      }),
    },
    valueGetter: (_value: any, row: any) =>
      (row.integrationIds || [])
        .map((i: GqlIntegrationShort) => i.name)
        .join(", "),
    renderCell: (params: GridRenderCellParams) => {
      const integrations: GqlIntegrationShort[] =
        params.row.integrationIds || [];
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
    field: "secretIds",
    headerName: "Secrets",
    flex: 1,
    sortField: "secret_ids.name",
    filter: {
      field: "secret_ids",
      operators: ["any"],
      valueType: "reference",
      defaultOperator: "any",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "secrets",
        labelField: "name",
      }),
    },
    valueGetter: (_value: any, row: any) =>
      (row.secretIds || []).map((s: GqlSecretShort) => s.name).join(", "),
    renderCell: (params: GridRenderCellParams) => {
      const secrets: GqlSecretShort[] = params.row.secretIds || [];
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
    sortField: "parents.name",
    flex: 1,
    valueGetter: (_value: any, row: any) =>
      (row.parents || []).map((p: GqlResourceShort) => p.name).join(", "),
    renderCell: (params: GridRenderCellParams) => {
      const parents: GqlResourceShort[] = params.row.parents || [];
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
    sortField: "children.name",
    flex: 1,
    valueGetter: (_value: any, row: any) =>
      (row.children || []).map((c: GqlResourceShort) => c.name).join(", "),
    renderCell: (params: GridRenderCellParams) => {
      const children: GqlResourceShort[] = params.row.children || [];
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
    filter: {
      field: "labels",
      operators: ["contains_all"],
      valueType: "autocomplete-multiple",
      defaultOperator: "contains_all",
      labelsEntity: "resource",
    },
    valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
    renderCell: (params: GridRenderCellParams) => (
      <Labels labels={params.row.labels || []} />
    ),
  },
  {
    field: "dependencyTags",
    headerName: "Dependency Tags",
    flex: 1,
    valueGetter: (_value: any, row: any) =>
      (row.dependencyTags || [])
        .map(
          (tag: { name: string; value: unknown }) =>
            `${tag.name}:${String(tag.value ?? "")}`,
        )
        .join(", "),
    renderCell: (params: GridRenderCellParams) =>
      (params.row.dependencyTags || [])
        .map(
          (tag: { name: string; value: unknown }) =>
            `${tag.name}:${String(tag.value ?? "")}`,
        )
        .join(", ") || null,
  },
  {
    field: "dependencyConfig",
    headerName: "Dependency Config",
    flex: 1,
    valueGetter: (_value: any, row: any) =>
      (row.dependencyConfig || [])
        .map(
          (cfg: { name: string; value: unknown }) =>
            `${cfg.name}:${String(cfg.value ?? "")}`,
        )
        .join(", "),
    renderCell: (params: GridRenderCellParams) =>
      (params.row.dependencyConfig || [])
        .map(
          (cfg: { name: string; value: unknown }) =>
            `${cfg.name}:${String(cfg.value ?? "")}`,
        )
        .join(", ") || null,
  },
];

export { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
