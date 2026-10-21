import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";

import {
  HeroCircleStackIcon,
  HeroHashtagIcon,
  HeroLanguageIcon,
  HeroSquare3Stack3DIcon,
  HeroXMarkIcon,
} from "../../../../icons";
import { Label, Tooltip } from "../../../../ui";
import { ENTITY_STATUS } from "../../../../utils";
import { cn } from "../../../../utils/cn";
import { STATUS_CHIP_COLOR } from "../../../utils";
import { EntityReference } from "../../fields/CommonField";

import {
  CONSTANT_OUTPUT_KEY,
  NodeSpec,
  PORT_COLOR,
  PortKind,
  WiringNodeKind,
} from "./graph";

const STATUS_BORDER: Record<string, string> = {
  success: "border-success",
  error: "border-error",
  info: "border-info",
  warning: "border-warning",
};

/** Unwired ports shown per section before "Show all". */
const COLLAPSED_LIMIT = 5;

export const NODE_WIDTH = 288;

/** Point on a node that sits under the pointer when it is dropped: middle of the header. */
export const DROP_ANCHOR = { x: NODE_WIDTH / 2, y: 22 };

/**
 * Controls inside a node stop pointerdown and carry `nodrag`, so pressing
 * them does not drag the node.
 */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export const KIND_META: Record<
  WiringNodeKind,
  { label: string; tile: string; Icon: typeof HeroSquare3Stack3DIcon }
> = {
  template: {
    label: "Template",
    tile: "bg-info/12 text-info",
    Icon: HeroSquare3Stack3DIcon,
  },
  external: {
    label: "Existing resource",
    tile: "bg-warning/15 text-warning",
    Icon: HeroCircleStackIcon,
  },
  constant: {
    label: "Constant",
    tile: "bg-secondary/12 text-secondary",
    Icon: HeroLanguageIcon,
  },
  ancestor: {
    label: "Not on canvas",
    tile: "bg-grey-900/6 text-fg-muted dark:bg-grey-100/8",
    Icon: HeroCircleStackIcon,
  },
};

export function NodeIcon({
  spec,
  className,
}: {
  spec: NodeSpec;
  className?: string;
}) {
  if (spec.kind === "constant" && spec.constantType === "number") {
    return <HeroHashtagIcon className={className} />;
  }
  const { Icon } = KIND_META[spec.kind];
  return <Icon className={className} />;
}

export const nodeKindLabel = (spec: NodeSpec) =>
  spec.kind === "constant"
    ? `${spec.constantType === "number" ? "Number" : "String"} constant`
    : KIND_META[spec.kind].label;

/** Port dot. The hit area is larger than the dot so it is easy to grab. */
export function SocketDot({ kind }: { kind: PortKind }) {
  return (
    <div className="group/socket inline-grid size-4 cursor-crosshair place-items-center align-middle">
      <div
        className="pointer-events-none size-2.5 rounded-full ring-2 ring-paper transition-transform group-hover/socket:scale-150"
        style={{ background: PORT_COLOR[kind] }}
      />
    </div>
  );
}

interface Row {
  name: string;
  kind: PortKind;
  inKey?: string;
  outKey?: string;
  required?: boolean;
  defaultValue?: unknown;
}

const hasDefault = (row: Row) =>
  row.defaultValue !== undefined && row.defaultValue !== null;

/** Default value as shown on the card, e.g. `"t3.micro"`, `3`, `["a"]`. */
const formatDefault = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

function rowsOf(spec: NodeSpec) {
  const inputs: Row[] = spec.inputs
    .filter((p) => p.kind === "input")
    .map((p) => ({
      name: p.name,
      kind: p.kind,
      inKey: p.key,
      required: p.required,
      defaultValue: p.defaultValue,
    }));
  const outputs: Row[] = spec.outputs
    .filter((p) => p.kind === "output")
    .map((p) => ({ name: p.name, kind: p.kind, outKey: p.key }));
  // A dependency config can be both set by a wire and used as a source
  const configs = new Map<string, Row>();
  for (const p of spec.inputs.filter((p) => p.kind === "config")) {
    configs.set(p.name, { name: p.name, kind: "config", inKey: p.key });
  }
  for (const p of spec.outputs.filter((p) => p.kind === "config")) {
    const row = configs.get(p.name) ?? { name: p.name, kind: "config" };
    configs.set(p.name, { ...row, outKey: p.key });
  }
  return { inputs, outputs, configs: [...configs.values()] };
}

export type RenderSocket = (
  side: "input" | "output",
  key: string,
  kind: PortKind,
  /** Changes whenever rows move, for canvases that measure ports once. */
  layoutKey: string,
) => ReactNode;

export interface NodeCardProps {
  spec: NodeSpec;
  selected: boolean;
  /** Port keys that have a wire. */
  wired: Set<string>;
  /** Show every port instead of only the wired ones and the first few. */
  expanded: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onConstantChange: (patch: { name?: string; defaultValue?: string }) => void;
  /** The canvas library's port element, placed on the card edge. */
  renderSocket: RenderSocket;
  /** View only: no remove button, constants cannot be edited. */
  readOnly?: boolean;
}

/** Body of a wiring node, shared by the editor and the read-only diagram. */
export function NodeCard({
  spec,
  selected,
  wired,
  expanded,
  onToggleExpanded,
  onRemove,
  onConstantChange,
  renderSocket,
  readOnly = false,
}: NodeCardProps) {
  const { step } = spec;
  const statusTone = step?.status
    ? (STATUS_CHIP_COLOR[step.status as ENTITY_STATUS] ?? "default")
    : undefined;
  const meta = KIND_META[spec.kind];
  const isWired = (row: Row) =>
    (row.inKey && wired.has(row.inKey)) ||
    (row.outKey && wired.has(row.outKey));
  /** Required input with no wire and no default: needs a value. */
  const isMissing = (row: Row) =>
    Boolean(row.required) && !isWired(row) && !hasDefault(row);

  const sections = rowsOf(spec);
  let hidden = 0;
  const visible = (rows: Row[]) => {
    if (expanded) return rows;
    let free = 0;
    // Missing required inputs stay visible so they are not overlooked
    const shown = rows.filter(
      (row) => isWired(row) || isMissing(row) || free++ < COLLAPSED_LIMIT,
    );
    hidden += rows.length - shown.length;
    return shown;
  };
  const inputs = visible(sections.inputs);
  const outputs = visible(sections.outputs);
  const configs = visible(sections.configs);
  const layoutKey = [...inputs, ...outputs, ...configs]
    .map((r) => r.inKey ?? r.outKey)
    .join("|");
  const missingCount = sections.inputs.filter(isMissing).length;

  const row = (r: Row) => {
    const active = isWired(r);
    const missing = isMissing(r);
    const showDefault = !active && hasDefault(r);
    const defaultText = showDefault ? formatDefault(r.defaultValue) : "";
    const hint = missing
      ? `${r.name}: required, not wired and no default. Wire it, or set it when the blueprint is used.`
      : showDefault
        ? `${r.name}: not wired, uses the default ${defaultText}`
        : r.required
          ? `${r.name}: required`
          : r.name;
    return (
      <div
        key={`${r.kind}:${r.name}`}
        className={cn(
          "relative flex h-7 items-center gap-2 px-4",
          missing && "bg-error/8",
        )}
      >
        {r.inKey && renderSocket("input", r.inKey, r.kind, layoutKey)}
        <Tooltip title={hint} placement="top" enterDelay={600}>
          <span
            className={cn(
              "flex min-w-0 flex-1 items-baseline font-mono text-[12px]",
              r.outKey && !r.inKey && "justify-end",
            )}
          >
            <span
              className={cn(
                "min-w-0 truncate",
                missing
                  ? "font-medium text-error"
                  : active
                    ? "font-medium text-fg"
                    : "text-fg-muted",
              )}
            >
              {r.name}
            </span>
            {r.required && (
              <span
                aria-label="required"
                className={cn(
                  "shrink-0 pl-0.5",
                  missing ? "text-error" : "text-fg-disabled",
                )}
              >
                *
              </span>
            )}
          </span>
        </Tooltip>
        {showDefault && (
          <span className="max-w-[45%] shrink-0 truncate rounded bg-grey-900/5 px-1.5 font-mono text-[11px] leading-[18px] text-fg-muted dark:bg-grey-100/8">
            {defaultText}
          </span>
        )}
        {r.outKey && renderSocket("output", r.outKey, r.kind, layoutKey)}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "group/node rounded-xl border bg-paper text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] transition-[box-shadow,border-color]",
        selected
          ? "border-primary ring-2 ring-primary/25"
          : statusTone && statusTone !== "default"
            ? STATUS_BORDER[statusTone]
            : "border-divider hover:border-grey-400",
        (spec.kind === "external" || spec.kind === "ancestor") &&
          !selected &&
          "border-dashed",
        spec.kind === "ancestor" && "bg-paper/70 opacity-80 shadow-none",
      )}
      style={{ width: NODE_WIDTH }}
      data-testid="wiring-node"
    >
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            meta.tile,
          )}
        >
          <NodeIcon spec={spec} className="text-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {step?.order != null && <Label size="small" label={step.order} />}
            <span className="truncate text-[13px] leading-5 font-semibold">
              {spec.kind === "constant" ? spec.title || "Unnamed" : spec.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] leading-4 text-fg-muted">
            <span className="truncate">{spec.note ?? nodeKindLabel(spec)}</span>
            {spec.abstract && (
              <Label tone="info" size="small" label="ABSTRACT" />
            )}
            {step?.status && (
              <Label
                tone={statusTone}
                size="small"
                label={step.status.replace("_", " ").toUpperCase()}
              />
            )}
            {missingCount > 0 && (
              <Tooltip title="Required inputs that are not wired and have no default">
                <Label
                  tone="error"
                  size="small"
                  label={`${missingCount} required`}
                />
              </Tooltip>
            )}
          </div>
        </div>
        {readOnly ? null : spec.kind === "ancestor" ? (
          <Tooltip title="Not part of this blueprint. Its outputs reach the dashed inputs at run time through the parent chain.">
            <span className="shrink-0 text-[11px] text-fg-disabled">
              {nodeKindLabel(spec)}
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Remove from canvas">
            <button
              type="button"
              aria-label={`Remove ${spec.title}`}
              className={cn(
                "nodrag grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-fg-muted opacity-0 transition group-hover/node:opacity-100 hover:bg-error/10 hover:text-error focus-visible:opacity-100",
              )}
              onPointerDown={stop}
              onClick={onRemove}
            >
              <HeroXMarkIcon className="text-[16px]" />
            </button>
          </Tooltip>
        )}
      </header>

      {(step?.resourceId || step?.errorMessage) && (
        <div className="grid gap-1.5 border-t border-divider px-3 py-2">
          {step.resourceId && (
            <div
              className="nodrag flex min-w-0 items-center gap-1 text-[12px]"
              onPointerDown={stop}
            >
              <span className="shrink-0 text-fg-muted">Resource:</span>
              <EntityReference
                id={step.resourceId}
                entityName="resource"
                identifier={
                  step.resourceName ?? `${step.resourceId.slice(0, 8)}…`
                }
              />
            </div>
          )}
          {step.errorMessage && (
            <Tooltip title={step.errorMessage}>
              <div className="cursor-help truncate rounded-md bg-error px-2 py-1 font-mono text-[11px] text-error-contrast">
                {step.errorMessage}
              </div>
            </Tooltip>
          )}
        </div>
      )}

      {spec.kind === "constant" ? (
        <ConstantBody
          spec={spec}
          onChange={onConstantChange}
          readOnly={readOnly}
        >
          {row({ name: "value", kind: "output", outKey: CONSTANT_OUTPUT_KEY })}
        </ConstantBody>
      ) : (
        <div className="border-t border-divider pb-1.5">
          {inputs.length + outputs.length + configs.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-fg-muted">No ports</div>
          )}
          <Section title="Inputs" kind="input" count={sections.inputs.length}>
            {inputs.map(row)}
          </Section>
          <Section
            title="Outputs"
            kind="output"
            count={sections.outputs.length}
          >
            {outputs.map(row)}
          </Section>
          <Section
            title="Dependency config"
            kind="config"
            count={sections.configs.length}
          >
            {configs.map(row)}
          </Section>
          {(hidden > 0 || expanded) && (
            <button
              type="button"
              className={cn(
                "nodrag mx-3 mt-1 w-[calc(100%-1.5rem)] cursor-pointer rounded-md border-0 bg-transparent px-0 py-1 text-[12px] font-medium text-fg-muted hover:bg-hover hover:text-fg",
              )}
              onPointerDown={stop}
              onClick={onToggleExpanded}
            >
              {expanded ? "Show wired only" : `Show ${hidden} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  kind,
  count,
  children,
}: {
  title: string;
  kind: PortKind;
  count: number;
  children: ReactNode[];
}) {
  if (count === 0) return null;
  return (
    <section className="pt-2">
      <div className="flex items-center gap-1.5 px-4 pb-0.5 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
        <span
          className="size-1.5 rounded-full"
          style={{ background: PORT_COLOR[kind] }}
        />
        {title}
        <span className="font-normal text-fg-disabled">{count}</span>
      </div>
      {children}
    </section>
  );
}

const FIELD_CLASS = cn(
  "nodrag h-8 w-full select-text rounded-md border border-divider bg-canvas px-2 font-mono text-[12px] text-fg outline-none transition-colors placeholder:text-fg-disabled focus:border-primary",
);

/** Wait for a pause in typing before an edit reaches the form. */
const COMMIT_DELAY = 300;

/** Name and value fields; edits are kept locally until props catch up. */
function ConstantBody({
  spec,
  onChange,
  readOnly,
  children,
}: {
  spec: NodeSpec;
  onChange: (patch: { name?: string; defaultValue?: string }) => void;
  readOnly?: boolean;
  children: ReactNode;
}) {
  const [name, setName] = useState(spec.title);
  const [value, setValue] = useState(spec.defaultValue ?? "");
  const [focused, setFocused] = useState(false);

  // Every commit rebuilds and re-syncs the whole graph, so send edits once
  // typing pauses or the field loses focus
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queued = useRef<{ name?: string; defaultValue?: string }>({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const commit = () => {
    clearTimeout(timer.current);
    const patch = queued.current;
    queued.current = {};
    if (Object.keys(patch).length) onChangeRef.current(patch);
  };
  const queue = (patch: { name?: string; defaultValue?: string }) => {
    queued.current = { ...queued.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(commit, COMMIT_DELAY);
  };
  // Send what is queued if the node goes away mid-edit
  useEffect(() => commit, []);

  useEffect(() => {
    if (focused) return;
    setName(spec.title);
    setValue(spec.defaultValue ?? "");
  }, [spec.title, spec.defaultValue, focused]);

  const fieldProps = {
    onPointerDown: stop,
    // Keep Backspace/Delete from removing the selection on the canvas
    onKeyDown: (e: KeyboardEvent) => e.stopPropagation(),
    onFocus: () => setFocused(true),
    onBlur: () => {
      commit();
      setFocused(false);
    },
    className: FIELD_CLASS,
    readOnly,
  };

  return (
    <div className="border-t border-divider pb-1.5">
      <div className="grid gap-2 px-3 pt-2.5 pb-1">
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-fg-muted">Name</span>
          <input
            {...fieldProps}
            value={name}
            placeholder="constant_name"
            onChange={(e) => {
              setName(e.target.value);
              queue({ name: e.target.value });
            }}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-fg-muted">
            Default value
          </span>
          <input
            {...fieldProps}
            type={spec.constantType === "number" ? "number" : "text"}
            value={value}
            placeholder={spec.constantType === "number" ? "0" : "value"}
            onChange={(e) => {
              setValue(e.target.value);
              queue({ defaultValue: e.target.value });
            }}
          />
        </label>
      </div>
      {children}
    </div>
  );
}
