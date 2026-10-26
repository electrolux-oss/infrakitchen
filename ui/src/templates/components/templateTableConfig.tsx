import { PermissionWrapper } from "../../common";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  labelsColumn,
  relativeTimeColumn,
} from "../../common/components/entity_table/tableColumns";
import { EntityReference } from "../../common/components/fields/CommonField";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { StatusLabel } from "../../common/components/labels";
import { Button, RenderCellParams } from "../../ui";
import { Label } from "../../ui/Label";
import { ENTITY_STATUS } from "../../utils/constants";

export const buildTemplateTableColumns = (
  onCreateResource: (templateId: string) => void,
): EntityTableColumn[] => [
  {
    field: "name",
    headerName: "Name",
    fetchFields: ["name", "id", "entityName", "abstract", "status"],
    flex: 1,
    hideable: false,
    filter: [
      {
        field: "name",
        operators: ["like", "not_like", "eq"],
        valueType: "text",
        defaultOperator: "like",
        defaultSelected: true,
      },
      {
        field: "status",
        label: "Status",
        operators: ["eq", "in"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Enabled", value: ENTITY_STATUS.ENABLED },
          { label: "Disabled", value: ENTITY_STATUS.DISABLED },
        ],
      },
    ],
    renderCell: (params: RenderCellParams) => (
      <div className="flex min-w-0 items-center gap-2">
        <StatusLabel status={params.row.status} compact />
        <EntityReference {...params.row} />
        {params.row.abstract && <Label tone="info" label="ABSTRACT" />}
      </div>
    ),
  },
  {
    field: "description",
    headerName: "Description",
    flex: 2,
    sortable: false,
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
  labelsColumn("template"),
  {
    field: "actions",
    headerName: "",
    width: 170,
    sortable: false,
    filterable: false,
    hideable: false,
    align: "right",
    fetchFields: ["id", "status"],
    renderCell: (params: RenderCellParams) => {
      // Status is serialized with its display casing (e.g. "DISABLED").
      const enabled =
        String(params.row.status ?? "").toLocaleLowerCase() !==
        ENTITY_STATUS.DISABLED;
      if (!enabled) return null;
      // Revealed on row hover/focus; always visible on touch devices.
      return (
        <div className="flex h-full items-center justify-end transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:hover)]:opacity-0">
          <PermissionWrapper
            requiredPermission="api:template"
            permissionAction="write"
          >
            <Button
              variant="contained"
              onClick={() => onCreateResource(params.row.id)}
            >
              Create Resource
            </Button>
          </PermissionWrapper>
        </div>
      );
    },
  },
];
