import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  NUMERIC_COLUMN_ALIGN,
  relativeTimeColumn,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";
import { getRepoNameFromUrl } from "../../common/utils";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { ProviderIcon } from "../../icons/Icons";
import { ENTITY_STATUS, VERSION_LIFECYCLE_STATE } from "../../utils/constants";

export const sourceCodeVersionDefaultColumnVisibilityModel: GridColumnVisibilityModel =
  {
    createdAt: false,
    creator: false,
    lifecycleState: false,
  };

export const sourceCodeVersionColumns: EntityTableColumn[] = [
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
      defaultSelected: true,
      makeReferenceLoader: serverSearchReference({
        entityPlural: "templates",
        labelField: "name",
        baseFilter: { abstract: false },
      }),
    },
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const template = params.row.template;
      return <Entity entity={template} />;
    },
  },
  {
    field: "identifier",
    headerName: "Version",
    fetchFields: [
      "identifier",
      "id",
      "entityName",
      "sourceCodeVersion",
      "sourceCodeBranch",
    ],
    flex: 1,
    hideable: false,
    filter: [
      {
        field: "source_code_folder",
        label: "Directory",
        operators: ["like", "not_like", "eq"],
        valueType: "text",
        defaultOperator: "like",
      },
      {
        field: "source_code_version",
        label: "Tag",
        operators: ["like", "not_like", "eq"],
        valueType: "text",
        defaultOperator: "like",
      },
    ],
    renderCell: (params: GridRenderCellParams) => {
      const { sourceCodeVersion, sourceCodeBranch } = params.row;
      return sourceCodeVersion || sourceCodeBranch ? (
        <Entity
          entity={{ ...params.row, entityType: "source_code_version" }}
          lifecycleVariant="dot"
          noWrap
        />
      ) : null;
    },
  },
  {
    field: "sourceCode",
    headerName: "Code Repository",
    flex: 1,
    minWidth: 300,
    sortField: "source_code.source_code_url",
    filter: {
      field: "source_code_id",
      label: "Code Repository",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "sourceCodes",
        labelField: "identifier",
        fields: ["sourceCodeUrl", "sourceCodeProvider"],
        mapOption: (sourceCode) => ({
          label: getRepoNameFromUrl(sourceCode.sourceCodeUrl),
          value: sourceCode.id,
          icon: <ProviderIcon provider={sourceCode.sourceCodeProvider} />,
        }),
      }),
    },
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: GridRenderCellParams) => {
      const sourceCode = params.row.sourceCode;
      return (
        <Entity
          entity={{
            ...sourceCode,
            sourceCodeUrl: sourceCode?.sourceCodeUrl,
            sourceCodeProvider: sourceCode?.sourceCodeProvider,
          }}
        />
      );
    },
  },
  {
    field: "resourcesCount",
    headerName: "Resources",
    width: 100,
    ...NUMERIC_COLUMN_ALIGN,
    valueGetter: (_value: any, row: any) => row.resourcesCount || 0,
  },
  {
    field: "status",
    headerName: "Status",
    width: 140,
    filter: {
      field: "status",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Queued", value: ENTITY_STATUS.QUEUED },
        { label: "In Progress", value: ENTITY_STATUS.IN_PROGRESS },
        { label: "Done", value: ENTITY_STATUS.DONE },
        { label: "Error", value: ENTITY_STATUS.ERROR },
        { label: "Unknown", value: ENTITY_STATUS.UNKNOWN },
        { label: "Pending", value: ENTITY_STATUS.PENDING },
        { label: "Ready", value: ENTITY_STATUS.READY },
      ],
    },
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={params.row.status} />
    ),
  },
  {
    field: "lifecycleState",
    headerName: "Lifecycle State",
    fetchFields: ["lifecycleState", "breakingChanges"],
    sortField: "lifecycleState",
    width: 160,
    filter: {
      field: "lifecycle_state",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Unknown", value: VERSION_LIFECYCLE_STATE.UNKNOWN },
        { label: "Preview", value: VERSION_LIFECYCLE_STATE.PREVIEW },
        { label: "Active", value: VERSION_LIFECYCLE_STATE.ACTIVE },
        { label: "Deprecated", value: VERSION_LIFECYCLE_STATE.DEPRECATED },
        { label: "Archived", value: VERSION_LIFECYCLE_STATE.ARCHIVED },
      ],
      renderSelectOption: (value) => (
        <VersionLifecycleStateChip lifecycleState={value} />
      ),
    },
    renderCell: (params: GridRenderCellParams) => (
      <VersionLifecycleStateChip
        lifecycleState={params.row.lifecycleState}
        breakingChanges={params.row.breakingChanges}
      />
    ),
  },
  relativeTimeColumn("createdAt", "Created", {
    value: (params) => params.row.createdAt,
  }),
  userColumn(),
];
