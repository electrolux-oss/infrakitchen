import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { Box, Typography } from "@mui/material";
import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
} from "@mui/x-data-grid";

import { CODE_FONT_FAMILY } from "../../common/theme";
import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { relativeTimeColumn } from "../../common/components/entity_table/tableColumns";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { ENTITY_STATUS, VERSION_LIFECYCLE_STATE } from "../../utils/constants";

export const sourceCodeVersionDefaultColumnVisibilityModel: GridColumnVisibilityModel =
  {
    createdAt: false,
    creator: false,
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
        label: "Folder Name",
        operators: ["like", "not_like", "eq"],
        valueType: "text",
        defaultOperator: "like",
        defaultSelected: true,
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
      // A version is pinned to either a tag or a branch.
      const refLine = sourceCodeVersion || sourceCodeBranch;
      const RefIcon = sourceCodeVersion
        ? LocalOfferOutlinedIcon
        : CallSplitOutlinedIcon;
      const codeSx = {
        fontFamily: CODE_FONT_FAMILY,
        fontSize: 13,
        lineHeight: 1.4,
        minWidth: 0,
      };
      return refLine ? (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}
        >
          <RefIcon color="action" sx={{ fontSize: 15, flexShrink: 0 }} />
          <Typography noWrap variant="body2" sx={codeSx}>
            {refLine}
          </Typography>
        </Box>
      ) : null;
    },
  },
  {
    field: "resourcesCount",
    headerName: "Resources",
    width: 100,
    renderCell: (params: GridRenderCellParams) => {
      const count = params.row.resourcesCount || 0;
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {count}
        </Box>
      );
    },
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
    renderCell: (params: GridRenderCellParams) => (
      <Entity entity={{ ...params.row.creator, entityType: "user" }} />
    ),
  },
];
