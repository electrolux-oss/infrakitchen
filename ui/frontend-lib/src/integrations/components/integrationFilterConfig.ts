import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { ENTITY_STATUS } from "../../utils/constants";
import { providers } from "../constants";
import { ConnectionType, IntegrationType } from "../types";

const providerOptions = providers
  .filter((provider) => provider.connectionType !== ConnectionType.SSH)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((provider) => ({
    label: provider.name,
    value: provider.slug,
  }));

const typeOptions = [
  { label: "Git", value: IntegrationType.GIT },
  { label: "Cloud", value: IntegrationType.CLOUD },
  { label: "Notification", value: IntegrationType.NOTIFICATION },
];

export const integrationColumns: EntityTableColumn[] = [
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
    filter: {
      field: "description",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
    },
  },
  {
    field: "integrationType",
    headerName: "Type",
    filter: {
      field: "integration_type",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: typeOptions,
    },
  },
  {
    field: "integrationProvider",
    headerName: "Provider",
    filter: {
      field: "integration_provider",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: providerOptions,
    },
  },
  {
    field: "labels",
    headerName: "Labels",
    filter: {
      field: "labels",
      operators: ["contains_all"],
      valueType: "autocomplete-multiple",
      defaultOperator: "contains_all",
      labelsEntity: "integration",
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
];
