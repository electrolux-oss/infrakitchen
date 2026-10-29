import { FavoriteButton } from "../../common/components/buttons/FavoriteButton";
import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  labelsColumn,
} from "../../common/components/entity_table/tableColumns";
import { ColumnFilterSpec } from "../../common/components/filter_panel/FilterConfig";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { DriftLabel, StatusLabel } from "../../common/components/labels";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { HeroShareIcon, HeroTagIcon } from "../../icons";
import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlSecretShort } from "../../secrets/graphql";
import { toolColumn } from "../../tools/components/toolColumn";
import { ColumnVisibilityModel, RenderCellParams } from "../../ui";
import {
  DRIFT_STATUS,
  ENTITY_STATE,
  ENTITY_STATUS,
  VERSION_LIFECYCLE_STATE,
} from "../../utils/constants";
import { GqlResourceShort } from "../graphql";
import { hasPendingChanges } from "../utils/pendingChanges";

// --- Column visibility defaults ---

export const resourceDefaultColumnVisibilityModel: ColumnVisibilityModel = {
  template: true,
  created_at: false,
  drift_status: false,
  storage: false,
  tool: true,
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
  sourceCodeVersion: true,
};

// Filter for JSON lists of { name, value } entries.
const nameValueFilter = (field: string): ColumnFilterSpec => ({
  field,
  operators: ["contains_entries"],
  valueType: "text",
  defaultOperator: "contains_entries",
  placeholder: "Type name or name:value, press Enter...",
});

// Entity renders as a block, so items and commas need an inline wrapping row.
const renderEntityList = (entities: Array<{ id: string }>) => {
  if (entities.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-1">
      {entities.map((entity, index) => (
        <div key={entity.id} className="inline-flex items-center">
          <Entity entity={entity} />
          {index < entities.length - 1 && ","}
        </div>
      ))}
    </div>
  );
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
    renderCell: (params: RenderCellParams) => (
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
    renderCell: (params: RenderCellParams) => {
      return <Entity entity={params.row} />;
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
    renderCell: (params: RenderCellParams) => {
      const template = params.row.template;
      return <Entity entity={template} />;
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
    sortField: "source_code_version.tag",
    filter: [
      {
        field: "source_code_version_id",
        label: "Template Version",
        operators: ["eq", "in"],
        valueType: "reference",
        defaultOperator: "eq",
        dependencies: ["template_id"],
        makeReferenceLoader: (ctx) => {
          // When a single Template filter is set, scope version options to
          // that template only. The template tag is then omitted from the
          // options since the template is implied by the scope.
          const getTemplateId = (): string | null => {
            const clauses = ctx.getFilterClauses?.() ?? [];
            const value = clauses.find((c) => c.field === "template_id")?.value;
            if (typeof value === "string" && value) return value;
            if (Array.isArray(value) && value.length === 1) {
              return String(value[0]);
            }
            return null;
          };

          const toOptions = (
            entities: Array<Record<string, any>>,
            templateId: string | null,
          ) =>
            entities
              .filter((e) => e.id && e.identifier)
              .map((e) => {
                const ref = e.sourceCodeVersion ?? e.sourceCodeBranch;
                const RefIcon = e.sourceCodeVersion
                  ? HeroTagIcon
                  : HeroShareIcon;
                return {
                  label: ref || e.identifier,
                  value: e.id,
                  icon: <RefIcon className="text-[15px]" color="action" />,
                  lifecycleState: e.lifecycleState,
                  breakingChanges: e.breakingChanges,
                  ...(templateId ? {} : { templateName: e.template?.name }),
                };
              });

          const withIcons = async (search: string) => {
            const templateId = getTemplateId();
            const filter: Record<string, any> = {};
            if (templateId) {
              filter["template_id"] = [templateId];
            }
            if (search.trim()) {
              filter["identifier__like"] = search.trim();
            }
            const response = await ctx.ikApi.graphqlRequest(
              `query ReferenceSearch($filter: JSON, $sort: [String!], $range: [Int!]) {
                sourceCodeVersions(filter: $filter, sort: $sort, range: $range) {
                  id
                  identifier
                  sourceCodeVersion
                  sourceCodeBranch
                  lifecycleState
                  breakingChanges
                  template { name }
                }
              }`,
              {
                filter,
                sort: ["identifier", "ASC"],
                range: [0, 50],
              },
            );
            const entities: Array<Record<string, any>> =
              response.sourceCodeVersions || [];
            return toOptions(entities, templateId);
          };

          withIcons.resolveByIds = async (ids: string[]) => {
            if (ids.length === 0) return [];
            const templateId = getTemplateId();
            const response = await ctx.ikApi.graphqlRequest(
              `query ReferenceResolveByIds($filter: JSON) {
                sourceCodeVersions(filter: $filter) {
                  id
                  identifier
                  sourceCodeVersion
                  sourceCodeBranch
                  lifecycleState
                  breakingChanges
                  template { name }
                }
              }`,
              {
                filter: {
                  ...(templateId ? { template_id: [templateId] } : {}),
                  id__in: ids,
                },
              },
            );
            const entities: Array<Record<string, any>> =
              response.sourceCodeVersions || [];
            return toOptions(entities, templateId);
          };
          return withIcons;
        },
      },
      {
        field: "source_code_version__lifecycle_state",
        label: "Template Version Lifecycle State",
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
        renderSelectOption: (value) => (
          <VersionLifecycleStateChip lifecycleState={value} />
        ),
      },
    ],
    valueGetter: (_value: any, row: any) => {
      const scv = row.sourceCodeVersion;
      if (!scv) return "";
      return scv.sourceCodeVersion ?? scv.sourceCodeBranch;
    },
    renderCell: (params: RenderCellParams) => {
      const scv = params.row.sourceCodeVersion;
      if (!scv) return null;
      return <Entity entity={scv} lifecycleVariant="dot" />;
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
    renderCell: (params: RenderCellParams) => {
      const project = params.row.project;
      return <Entity entity={project} />;
    },
  },

  {
    field: "state",
    fetchFields: ["state", "status", "tempState"],
    headerName: "State",
    // Wider share: the state reads like "PROVISIONED [DONE]" plus a
    // "Needs review" pill, so it needs more room than a plain name.
    flex: 1.5,
    mobile: "badge",
    filter: [
      {
        field: "state",
        label: "State",
        operators: ["eq", "in"],
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
        operators: ["eq", "in"],
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
    renderCell: (params: RenderCellParams) => (
      <StatusLabel
        status={String(params.row.status).toLowerCase()}
        state={String(params.row.state).toLowerCase()}
        needsReview={hasPendingChanges(params.row)}
      />
    ),
  },
  {
    field: "drift_status",
    fetchFields: ["drift.status", "drift.checked_at"],
    headerName: "Drift",
    width: 130,
    filter: {
      field: "drift__status",
      label: "Drift",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "In sync", value: DRIFT_STATUS.IN_SYNC },
        { label: "Drifted", value: DRIFT_STATUS.DRIFTED },
        { label: "Check failed", value: DRIFT_STATUS.ERROR },
      ],
    },
    valueGetter: (_value: any, row: any) => row.drift?.status,
    renderCell: (params: RenderCellParams) => (
      <DriftLabel driftStatus={params.row.drift?.status} />
    ),
  },
  ...createdUpdatedColumns({
    withCreator: true,
    createdField: "created_at",
    updatedField: "updated_at",
    createdValue: (params: RenderCellParams) => params.row.createdAt,
    updatedValue: (params: RenderCellParams) => params.row.updatedAt,
  }),
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
    renderCell: (params: RenderCellParams) => {
      const storage = params.row.storage;
      if (!storage) return null;
      return <Entity entity={storage} />;
    },
  },
  toolColumn(),
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
    renderCell: (params: RenderCellParams) => {
      const workspace = params.row.workspace;
      if (!workspace) return null;
      return <Entity entity={workspace} />;
    },
  },
  {
    field: "integrationIds",
    headerName: "Integrations",
    flex: 1,
    sortable: false,
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
    renderCell: (params: RenderCellParams) => {
      const integrations: GqlIntegrationShort[] =
        params.row.integrationIds || [];
      return renderEntityList(integrations);
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
    renderCell: (params: RenderCellParams) =>
      renderEntityList(params.row.secretIds || []),
  },
  {
    field: "parents",
    headerName: "Parents",
    sortField: "parents.name",
    flex: 1,
    valueGetter: (_value: any, row: any) =>
      (row.parents || []).map((p: GqlResourceShort) => p.name).join(", "),
    renderCell: (params: RenderCellParams) =>
      renderEntityList(params.row.parents || []),
  },
  {
    field: "children",
    headerName: "Children",
    sortField: "children.name",
    flex: 1,
    valueGetter: (_value: any, row: any) =>
      (row.children || []).map((c: GqlResourceShort) => c.name).join(", "),
    renderCell: (params: RenderCellParams) =>
      renderEntityList(params.row.children || []),
  },
  {
    field: "variables",
    headerName: "Variables",
    flex: 1,
    sortable: false,
    filter: nameValueFilter("variables"),
    valueGetter: (_value: any, row: any) =>
      (row.variables || []).map((v: { name: string }) => v.name).join(", "),
    renderCell: (params: RenderCellParams) =>
      (params.row.variables || [])
        .map((v: { name: string }) => v.name)
        .join(", ") || null,
  },
  {
    field: "outputs",
    headerName: "Outputs",
    flex: 1,
    sortable: false,
    filter: nameValueFilter("outputs"),
    valueGetter: (_value: any, row: any) =>
      (row.outputs || []).map((o: { name: string }) => o.name).join(", "),
    renderCell: (params: RenderCellParams) =>
      (params.row.outputs || [])
        .map((o: { name: string }) => o.name)
        .join(", ") || null,
  },
  labelsColumn("resource"),
  {
    field: "dependencyTags",
    headerName: "Dependency Tags",
    flex: 1,
    sortable: false,
    filter: nameValueFilter("dependency_tags"),
    valueGetter: (_value: any, row: any) =>
      (row.dependencyTags || [])
        .map(
          (tag: { name: string; value: unknown }) =>
            `${tag.name}:${String(tag.value ?? "")}`,
        )
        .join(", "),
    renderCell: (params: RenderCellParams) =>
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
    sortable: false,
    filter: nameValueFilter("dependency_config"),
    valueGetter: (_value: any, row: any) =>
      (row.dependencyConfig || [])
        .map(
          (cfg: { name: string; value: unknown }) =>
            `${cfg.name}:${String(cfg.value ?? "")}`,
        )
        .join(", "),
    renderCell: (params: RenderCellParams) =>
      (params.row.dependencyConfig || [])
        .map(
          (cfg: { name: string; value: unknown }) =>
            `${cfg.name}:${String(cfg.value ?? "")}`,
        )
        .join(", ") || null,
  },
];

export { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
