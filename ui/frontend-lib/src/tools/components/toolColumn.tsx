import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { RenderCellParams } from "../../ui";
import { ToolShort, toolLabel } from "../types";

/** IaC tool selected by a resource or an executor, empty means the global default. */
export const toolColumn = (): EntityTableColumn => ({
  field: "tool",
  headerName: "IaC Tool",
  flex: 1,
  sortField: "tool.version",
  filter: {
    field: "tool_id",
    operators: ["eq", "in", "is_none"],
    valueType: "reference",
    defaultOperator: "eq",
    makeReferenceLoader: serverSearchReference({
      entityPlural: "tools",
      labelField: "version",
      fields: ["name", "os", "arch"],
      mapOption: (tool) => ({
        label: toolLabel(tool as ToolShort),
        value: tool.id,
      }),
    }),
  },
  valueGetter: (_value: any, row: any) => (row.tool ? toolLabel(row.tool) : ""),
  renderCell: (params: RenderCellParams) => {
    const tool = params.row.tool as ToolShort | null | undefined;
    if (!tool) {
      return <p className="m-0 text-body2 text-fg-muted">Global default</p>;
    }
    return (
      <Entity
        entity={{
          ...tool,
          entityType: "tool",
          tool: tool.name,
          name: toolLabel(tool),
        }}
      />
    );
  },
});
