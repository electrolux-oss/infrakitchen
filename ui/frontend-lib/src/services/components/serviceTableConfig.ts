import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";

export const serviceColumns: EntityTableColumn[] = [
  {
    field: "name",
    headerName: "Name",
    filter: {
      field: "name",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
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
      labelsEntity: "service",
    },
  },
  {
    field: "project",
    headerName: "Project",
    filter: {
      field: "project_id",
      label: "Project",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "projects",
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
