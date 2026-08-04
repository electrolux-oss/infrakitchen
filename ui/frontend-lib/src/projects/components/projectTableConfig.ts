import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { ENTITY_STATUS } from "../../utils/constants";

export const projectColumns: EntityTableColumn[] = [
  {
    field: "name",
    headerName: "Name",
    filter: {
      field: "name",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
    },
  },
  {
    field: "description",
    headerName: "Description",
  },
  {
    field: "labels",
    headerName: "Labels",
    filter: {
      field: "labels",
      operators: ["contains_all"],
      valueType: "autocomplete-multiple",
      defaultOperator: "contains_all",
      labelsEntity: "project",
    },
  },
  {
    field: "status",
    headerName: "Status",
    filter: {
      field: "status",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Enabled", value: ENTITY_STATUS.ENABLED },
        { label: "Disabled", value: ENTITY_STATUS.DISABLED },
      ],
    },
  },
  {
    field: "workspace",
    headerName: "Workspace",
    filter: {
      field: "workspace_id",
      label: "Workspace",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "workspaces",
        labelField: "name",
      }),
    },
  },
  {
    field: "creator",
    headerName: "Creator",
    filter: {
      field: "created_by",
      label: "Creator",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "users",
        labelField: "identifier",
      }),
    },
  },
];
