import { Handle, NodeProps, Position } from "@xyflow/react";

import { HeroTrashIcon } from "../../../../icons";
import { HeroHashtagIcon, HeroLanguageIcon } from "../../../../icons";
import { IconButton, Label, Tooltip, TextField } from "../../../../ui";
import { cn } from "../../../../utils/cn";
import { InlineCode } from "../../code/InlineCode";

import { CANVAS_PALETTE, DiagramNode, makeHandleStyle } from "./helpers";

export function ConstantNode({ data }: NodeProps<DiagramNode>) {
  const palette = CANVAS_PALETTE;
  const bg = palette.background.paper;
  const canRemove = typeof data.onRemove === "function";
  const canEdit = typeof data.onUpdate === "function" && !!data.constantId;
  const hasOutputs = Array.isArray(data.outputs) && data.outputs.length > 0;
  const valueLabel = data.name || data.label || "value";

  return (
    <div
      className="max-w-75 min-w-55 rounded-surface border border-secondary shadow-[var(--ik-shadow-2)]"
      style={{ background: bg }}
    >
      <div className="flex items-center justify-between gap-2 rounded-t-[6px] border-b border-divider px-3 py-1 [background:color-mix(in_srgb,var(--color-secondary)_85%,transparent)]">
        <div className="flex min-w-0 items-center gap-1.5">
          {data.constantType === "number" ? (
            <HeroHashtagIcon
              style={{ color: palette.secondary.contrastText }}
              fontSize="small"
            />
          ) : (
            <HeroLanguageIcon
              style={{ color: palette.secondary.contrastText }}
              fontSize="small"
            />
          )}
          <h6 className="m-0 min-w-0 truncate text-subtitle2 font-bold text-secondary-contrast">
            {canEdit ? "Constant" : data.label}
          </h6>
          <InlineCode
            className="shrink-0 bg-[rgba(255,_255,_255,_0.18)] text-secondary-contrast"
            disableCopy
          >
            {data.constantType === "number" ? "number" : "string"}
          </InlineCode>
        </div>
        {canRemove && (
          <Tooltip title="Remove" arrow>
            <IconButton
              style={{ color: palette.secondary.contrastText }}
              className="ml-1 p-0.5 hover:bg-error/35"
              size="small"
              onClick={() =>
                data.onRemove?.(data.constantId ?? data.templateId)
              }
            >
              <HeroTrashIcon className="text-[16px]" />
            </IconButton>
          </Tooltip>
        )}
      </div>

      <div className={cn("p-3 pt-6", canEdit ? "nodrag nowheel" : undefined)}>
        {canEdit && (
          <TextField
            className="mb-4"
            label="Name"
            value={data.name ?? ""}
            onChange={(e) => data.onUpdate?.(data.constantId!, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            fullWidth
          />
        )}

        {canEdit && (
          <TextField
            className="mb-2"
            label="Default Value"
            type={data.constantType === "number" ? "number" : "text"}
            value={data.defaultValue ?? ""}
            onChange={(e) =>
              data.onDefaultValueUpdate?.(data.constantId!, e.target.value)
            }
            onKeyDown={(e) => e.stopPropagation()}
            fullWidth
          />
        )}

        {hasOutputs && (
          <div className="mt-2">
            {data.outputs.map((output) => (
              <div
                className="my-[3.2px] flex items-center justify-end"
                key={`out-${output}`}
              >
                <Label label={output} tone="secondary" />
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
                      ...makeHandleStyle(palette.secondary.main, bg),
                      marginLeft: 4,
                    }}
                  />
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {!hasOutputs && (
          <div className="mt-1 flex items-center justify-end">
            <Label label={valueLabel} tone="secondary" />
            <Tooltip
              title={
                <>
                  Drag to connect{" "}
                  <InlineCode className="mx-0.5" disableCopy>
                    {valueLabel}
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
                id="output-value"
                style={{
                  ...makeHandleStyle(palette.secondary.main, bg),
                  marginLeft: 4,
                }}
              />
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
