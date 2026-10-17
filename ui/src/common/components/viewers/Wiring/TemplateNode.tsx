import { Handle, NodeProps, Position } from "@xyflow/react";

import { DeleteIcon, StorageIcon } from "../../../../icons/material";
import { IconButton, Chip, Tooltip } from "../../../../ui";
import { STATUS_CHIP_COLOR } from "../../../utils";
import { InlineCode } from "../../code/InlineCode";
import { GetReferenceUrlValue } from "../../fields/CommonField";

import { CANVAS_PALETTE, DiagramNode, makeHandleStyle } from "./helpers";

export function TemplateNode({ data }: NodeProps<DiagramNode>) {
  const palette = CANVAS_PALETTE;
  const bg = palette.background.paper;
  const isExternal = data.kind === "external";
  const displayOrder =
    data.order ??
    (data.stepPosition != null ? data.stepPosition + 1 : undefined);
  const canRemove = typeof data.onRemove === "function";

  // External nodes always use warning palette; template nodes use the
  // theme's `info` blue unless a workflow status overrides it.
  const accent = palette.info.main;
  let headerBg = isExternal ? palette.warning.main : accent;
  let headerText = isExternal ? palette.warning.contrastText : "#ffffff";
  let borderStyle = isExternal ? "dashed" : "solid";
  let borderColor = isExternal ? palette.warning.main : accent;

  if (!isExternal && data.status && data.status !== "pending") {
    const p =
      data.status === "done"
        ? palette.success
        : data.status === "error"
          ? palette.error
          : data.status === "in_progress"
            ? palette.info
            : palette.warning;
    headerBg = p.main;
    headerText = p.contrastText;
    borderColor = p.main;
  }

  return (
    <div
      className="max-w-75 min-w-55 rounded-surface shadow-[var(--ik-shadow-2)]"
      style={{ background: bg, border: `1px ${borderStyle} ${borderColor}` }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 rounded-t-[6px] border-b border-divider px-3 py-1"
        style={{
          background: `color-mix(in srgb, ${headerBg} 85%, transparent)`,
        }}
      >
        {isExternal && (
          <StorageIcon
            style={{ color: headerText }}
            className="shrink-0"
            fontSize="small"
          />
        )}
        {displayOrder != null && (
          // Not a Chip: the theme's dark-mode Chip background out-specifies
          // `sx` and would force a grey badge onto the coloured header.
          <div
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,_255,_255,_0.25)] px-1 text-[11px] leading-[1] font-bold"
            style={{ color: headerText }}
          >
            {displayOrder}
          </div>
        )}
        <h6
          className="m-0 flex-1 overflow-hidden text-subtitle2 font-bold text-ellipsis whitespace-nowrap text-grey-500"
          style={{ color: headerText }}
        >
          {data.label}
        </h6>
        {data.status && !canRemove && (
          <Chip
            className="h-5 text-[10px] font-semibold"
            label={data.status.replace("_", " ").toUpperCase()}
            color={STATUS_CHIP_COLOR[data.status]}
          />
        )}
        {canRemove && (
          <Tooltip title="Remove" arrow>
            <IconButton
              style={{ color: headerText }}
              className="ml-1 p-0.5 hover:bg-error/35"
              size="small"
              onClick={() => data.onRemove?.(data.templateId)}
            >
              <DeleteIcon className="text-[16px]" />
            </IconButton>
          </Tooltip>
        )}
      </div>
      {/* External badge */}
      {isExternal && (
        <div className="px-3 pt-2">
          <Chip label="External" variant="outlined" color="warning" />
          <span className="mt-1 mb-1 block text-caption text-fg-muted">
            Parent resource as input
          </span>
        </div>
      )}
      {/* Resource link (workflow mode only) */}
      {data.resourceId && (
        <div className="flex items-center gap-1 px-3 pt-2">
          <span className="text-caption text-fg-muted">Resource:</span>
          <GetReferenceUrlValue
            id={data.resourceId}
            entityName="resource"
            identifier={data.resourceName ?? `${data.resourceId.slice(0, 8)}…`}
          />
        </div>
      )}
      {/* Error message (workflow mode only) */}
      {data.errorMessage && (
        <Tooltip title={data.errorMessage} arrow>
          <div className="mx-3 mt-1.5 cursor-help overflow-hidden rounded-surface bg-error p-1.5 font-mono text-[11px] text-ellipsis whitespace-nowrap text-error-contrast">
            {data.errorMessage}
          </div>
        </Tooltip>
      )}
      {/* Ports */}
      <div className="flex gap-4 p-3">
        {data.inputs.length > 0 && (
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-caption font-semibold text-fg-muted">
              Inputs
            </span>
            {data.inputs.map((input) => (
              <div
                className="my-[3.2px] flex min-w-0 items-center"
                key={`in-${input}`}
              >
                <Tooltip
                  title={
                    <>
                      Drag from an output to connect it to{" "}
                      <InlineCode className="mx-0.5" disableCopy>
                        {input}
                      </InlineCode>
                    </>
                  }
                  arrow
                  placement="left"
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`input-${input}`}
                    style={{
                      ...makeHandleStyle(palette.info.main, bg),
                      marginRight: 4,
                    }}
                  />
                </Tooltip>
                <Tooltip title={input} arrow>
                  <Chip
                    className="min-w-0 flex-initial text-[11px]"
                    label={input}
                    variant="outlined"
                    color="info"
                  />
                </Tooltip>
                <Tooltip
                  title={
                    <>
                      Drag to use{" "}
                      <InlineCode className="mx-0.5" disableCopy>
                        {input}
                      </InlineCode>{" "}
                      as a source for another input
                    </>
                  }
                  arrow
                  placement="right"
                >
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`input-source-${input}`}
                    style={{
                      ...makeHandleStyle(palette.info.light, bg, 7),
                      marginLeft: 4,
                    }}
                  />
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {data.outputs.length > 0 && (
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-right text-caption font-semibold text-fg-muted">
              Outputs
            </span>
            {data.outputs.map((output) => (
              <div
                className="my-[3.2px] flex min-w-0 items-center justify-end"
                key={`out-${output}`}
              >
                <Tooltip title={output} arrow>
                  <Chip
                    className="min-w-0 flex-initial text-[11px]"
                    label={output}
                    variant="outlined"
                    color="success"
                  />
                </Tooltip>
                <Tooltip
                  title={
                    <>
                      Drag to connect{" "}
                      <InlineCode className="mx-0.5" disableCopy>
                        {output}
                      </InlineCode>{" "}
                      to an input
                    </>
                  }
                  arrow
                  placement="right"
                >
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`output-${output}`}
                    style={{
                      ...makeHandleStyle(palette.success.main, bg),
                      marginLeft: 4,
                    }}
                  />
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Required configuration variables: set from a wire and usable as a source */}
      {(data.configs?.length ?? 0) > 0 && (
        <div className="px-3 pb-3">
          <span className="mb-1 block text-caption font-semibold text-fg-muted">
            Dependency config
          </span>
          {data.configs?.map((config) => (
            <div
              className="my-[3.2px] flex min-w-0 items-center"
              key={`config-${config}`}
            >
              {/* External resources already exist, their config is only a source */}
              {!isExternal && (
                <Tooltip
                  title={
                    <>
                      Drag from an output or constant to set{" "}
                      <InlineCode className="mx-0.5" disableCopy>
                        {config}
                      </InlineCode>
                    </>
                  }
                  arrow
                  placement="left"
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`config-in-${config}`}
                    style={{
                      ...makeHandleStyle(palette.secondary.main, bg),
                      marginRight: 4,
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title={config} arrow>
                <Chip
                  className="mr-auto min-w-0 flex-initial text-[11px]"
                  label={config}
                  variant="outlined"
                  color="secondary"
                />
              </Tooltip>
              <Tooltip
                title={
                  <>
                    Drag to connect{" "}
                    <InlineCode className="mx-0.5" disableCopy>
                      {config}
                    </InlineCode>{" "}
                    to an input
                  </>
                }
                arrow
                placement="right"
              >
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`config-out-${config}`}
                  style={{
                    ...makeHandleStyle(palette.secondary.main, bg),
                    marginLeft: 4,
                  }}
                />
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
