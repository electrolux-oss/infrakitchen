import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  labelsColumn,
  relativeTimeColumn,
} from "../../common/components/entity_table/tableColumns";
import { EntityReference } from "../../common/components/fields/CommonField";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { RenderCellParams } from "../../ui";

export const serviceTableColumns: EntityTableColumn[] = [
  {
    field: "name",
    headerName: "Name",
    fetchFields: ["name", "displayName", "id", "entityName"],
    flex: 1,
    hideable: false,
    filter: {
      field: "name",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    renderCell: (params: RenderCellParams) => (
      <EntityReference
        {...params.row}
        display_name={params.row.displayName}
        entityName="service"
      />
    ),
  },
  {
    field: "description",
    headerName: "Description",
    flex: 2,
    sortable: false,
  },
  {
    field: "project",
    headerName: "Project",
    flex: 1,
    fetchFields: ["project"],
    sortField: "project.name",
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
    valueGetter: (value: any) => value?.name || "",
    renderCell: (params: RenderCellParams) =>
      params.row.project ? (
        <EntityReference {...params.row.project} entityName="project" />
      ) : null,
  },
  {
    ...relativeTimeColumn("updatedAt", "Updated"),
    // The creator filter stays available even though Created isn't shown.
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
  labelsColumn("service"),
];
