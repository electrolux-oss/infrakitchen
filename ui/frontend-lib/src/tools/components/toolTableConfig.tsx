import DeleteIcon from "@mui/icons-material/Delete";
import { Button, Chip, Stack } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  relativeTimeColumn,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import StatusChip from "../../common/StatusChip";
import { Tool, TOOL_NAMES, toolStatus, formatToolSize } from "../types";

export const TOOL_PENDING_STATUSES = ["queued", "in_progress"];

export interface ToolRowActions {
  onRetry: (tool: Tool) => void;
  onSetDefault: (tool: Tool) => void;
  onAction: (tool: Tool, action: "disable" | "enable") => void;
  onDelete: (tool: Tool) => void;
}

export const toolColumns = (actions: ToolRowActions): EntityTableColumn[] => [
  {
    field: "name",
    headerName: "Tool",
    flex: 1,
    hideable: false,
    filter: {
      field: "name",
      operators: ["eq"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: TOOL_NAMES,
    },
    fetchFields: ["name", "entityName"],
    renderCell: (params: GridRenderCellParams) => (
      <Entity
        entity={{
          ...params.row,
          tool: params.value,
          name:
            TOOL_NAMES.find((item) => item.value === params.value)?.label ||
            params.value,
        }}
      />
    ),
  },
  {
    field: "version",
    headerName: "Version",
    flex: 1,
    hideable: false,
    filter: {
      field: "version",
      operators: ["like", "eq", "not_like"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
  },
  {
    field: "arch",
    fetchFields: ["os", "arch"],
    headerName: "Platform",
    flex: 1,
    filter: {
      field: "arch",
      operators: ["eq"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "amd64", value: "amd64" },
        { label: "arm64", value: "arm64" },
      ],
    },
    valueGetter: (_value: any, row: any) => `${row.os}/${row.arch}`,
  },
  {
    field: "status",
    fetchFields: ["status", "isDefault"],
    headerName: "Status",
    flex: 1,
    filter: {
      field: "status",
      operators: ["eq"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "queued", value: "queued" },
        { label: "in progress", value: "in_progress" },
        { label: "done", value: "done" },
        { label: "error", value: "error" },
        { label: "disabled", value: "disabled" },
      ],
    },
    renderCell: (params: GridRenderCellParams) => (
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: "center", height: "100%" }}
      >
        <StatusChip status={toolStatus(params.row as Tool)} />
        {params.row.isDefault && (
          <Chip size="small" label="default" color="primary" />
        )}
      </Stack>
    ),
  },
  {
    field: "size",
    headerName: "Size",
    width: 100,
    valueGetter: (value: number) => formatToolSize(value),
  },
  {
    field: "resourcesCount",
    fetchFields: ["resourcesCount"],
    headerName: "Resources",
    width: 110,
    sortable: false,
    filterable: false,
  },
  {
    field: "executorsCount",
    fetchFields: ["executorsCount"],
    headerName: "Executors",
    width: 110,
    sortable: false,
    filterable: false,
  },
  userColumn({ headerName: "Added by" }),
  relativeTimeColumn("createdAt", "Created", { sortField: "created_at" }),
  {
    field: "actions",
    fetchFields: ["name", "version", "os", "arch", "status", "isDefault"],
    headerName: "",
    width: 240,
    sortable: false,
    filterable: false,
    hideable: false,
    align: "right",
    renderCell: (params: GridRenderCellParams) => {
      const tool = params.row as Tool;
      const status = toolStatus(tool);
      return (
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "flex-end", alignItems: "center", height: 1 }}
          // buttons must not also open the tool page via the row click
          onClick={(event) => event.stopPropagation()}
        >
          {status === "error" && (
            <Button size="small" onClick={() => actions.onRetry(tool)}>
              Retry
            </Button>
          )}
          {status === "done" && !tool.isDefault && (
            <Button size="small" onClick={() => actions.onSetDefault(tool)}>
              Set default
            </Button>
          )}
          {["done", "error"].includes(status) && !tool.isDefault && (
            <Button
              size="small"
              color="warning"
              onClick={() => actions.onAction(tool, "disable")}
            >
              Disable
            </Button>
          )}
          {status === "disabled" && (
            <Button
              size="small"
              onClick={() => actions.onAction(tool, "enable")}
            >
              Enable
            </Button>
          )}
          {status === "disabled" && (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => actions.onDelete(tool)}
            >
              Delete
            </Button>
          )}
        </Stack>
      );
    },
  },
];
