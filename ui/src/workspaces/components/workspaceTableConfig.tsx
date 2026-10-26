import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  createdUpdatedColumns,
  labelsColumn,
} from "../../common/components/entity_table/tableColumns";
import { getProviderValue } from "../../common/components/fields/CommonField";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { StatusLabel } from "../../common/components/labels";
import { RenderCellParams } from "../../ui";
import { ENTITY_STATUS } from "../../utils/constants";

export const workspaceColumns: EntityTableColumn[] = [
  {
    field: "name",
    headerName: "Name",
    fetchFields: ["id", "name", "entityName"],
    flex: 1,
    hideable: false,
    filter: {
      field: "name",
      operators: ["like", "eq", "not_like"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    renderCell: (params: RenderCellParams) => {
      return <Entity entity={params.row} />;
    },
  },
  {
    field: "workspaceProvider",
    headerName: "Provider",
    flex: 1,
    filter: {
      field: "workspace_provider",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "GitHub", value: "github" },
        { label: "Bitbucket", value: "bitbucket" },
        { label: "Azure DevOps", value: "azure_devops" },
      ],
    },
    renderCell: (params: RenderCellParams) => (
      <div className="flex h-full items-center">
        {getProviderValue(params.value, 18)}
      </div>
    ),
  },
  {
    field: "state",
    fetchFields: ["status"],
    headerName: "State",
    flex: 1,
    filter: {
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
    renderCell: (params: RenderCellParams) => (
      <StatusLabel status={String(params.row.status).toLowerCase()} />
    ),
  },
  ...createdUpdatedColumns({ withCreator: true }),
  {
    field: "integration",
    headerName: "Integration",
    flex: 1,
    sortField: "integration.name",
    filter: {
      field: "integration_id",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "integrations",
        labelField: "name",
      }),
    },
    valueGetter: (_value: any, row: any) => row.integration?.name || "",
    renderCell: (params: RenderCellParams) =>
      params.row.integration ? (
        <Entity entity={params.row.integration} />
      ) : null,
  },
  labelsColumn("workspace"),
];
