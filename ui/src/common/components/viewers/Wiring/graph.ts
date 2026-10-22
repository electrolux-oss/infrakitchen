import { parseSourceHandle, parseTargetHandle } from "./helpers";
import { GenericTemplate, WiringRule } from "./types";
import {
  ConstantType,
  InputMeta,
  TemplatePorts,
  WiringCanvasConstantBlock,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";

/** `ancestor`: a parent further up the chain that is not on the canvas. */
export type WiringNodeKind = "template" | "external" | "constant" | "ancestor";

/** What a port carries; decides its colour and which ports it can wire to. */
export type PortKind = "input" | "output" | "config";

export interface PortSpec {
  /** Port key: `input-<name>`, `output-<name>`, `config-in-<name>` or `config-out-<name>`. */
  key: string;
  name: string;
  kind: PortKind;
  /** Inputs only: the template marks the variable as required. */
  required?: boolean;
  /** Inputs only: the variable's default, if it has one. */
  defaultValue?: unknown;
}

/** Plain description of a node, built from the canvas props. */
export interface NodeSpec {
  id: string;
  kind: WiringNodeKind;
  /** Template or constant id, without the node id prefix. */
  entityId: string;
  title: string;
  abstract?: boolean;
  inputs: PortSpec[];
  outputs: PortSpec[];
  constantType?: ConstantType;
  defaultValue?: string;
  /** Short line under the title, e.g. which node an ancestor sits above. */
  note?: string;
  /** Workflow run details, shown by the read-only diagram. */
  step?: NodeStep;
}

export interface NodeStep {
  /** 1-based run order. */
  order?: number;
  status?: string;
  errorMessage?: string | null;
  resourceId?: string | null;
  resourceName?: string;
}

export interface WireSpec {
  id: string;
  rule: WiringRule;
  source: string;
  sourceOutput: string;
  target: string;
  targetInput: string;
  /**
   * Shown only: the input is filled at run time from an ancestor that is
   * not on the canvas. Never part of the saved wiring.
   */
  inherited?: boolean;
  /**
   * Set by the target template's source code configuration (a template
   * reference), so it cannot be removed on the canvas.
   */
  fromSource?: boolean;
  /** Overrides the colour from the wire type, e.g. by workflow step status. */
  color?: string;
}

/** Stable identity of a wiring rule; also the id of its connection. */
export function wiringRuleKey(rule: WiringRule): string {
  return [
    rule.source_template_id,
    rule.source_type ?? "output",
    rule.source_output,
    rule.target_template_id,
    rule.target_type ?? "variable",
    rule.target_variable,
  ].join("|");
}

const NODE_ID_PREFIX: Record<WiringNodeKind, string> = {
  template: "",
  external: "ext-",
  constant: "const-",
  ancestor: "anc-",
};

export const nodeIdOf = (kind: WiringNodeKind, entityId: string) =>
  `${NODE_ID_PREFIX[kind]}${entityId}`;

/** Constants have a single output whatever their name, so renames keep wires. */
export const CONSTANT_OUTPUT_KEY = "output-value";

const inputPort = (name: string, meta?: InputMeta): PortSpec => ({
  key: `input-${name}`,
  name,
  kind: "input",
  required: meta?.required,
  defaultValue: meta?.default,
});
const outputPort = (name: string): PortSpec => ({
  key: `output-${name}`,
  name,
  kind: "output",
});
const configInPort = (name: string): PortSpec => ({
  key: `config-in-${name}`,
  name,
  kind: "config",
});
const configOutPort = (name: string): PortSpec => ({
  key: `config-out-${name}`,
  name,
  kind: "config",
});

const unique = (names: Iterable<string>) => [...new Set(names)];

export interface GraphInput {
  selectedTemplates: GenericTemplate[];
  externalTemplates: WiringCanvasExternalTemplate[];
  constants: WiringCanvasConstantBlock[];
  templatePorts: Record<string, TemplatePorts>;
  wiring: WiringRule[];
}

/**
 * Nodes and wires to show for the canvas props. Ports named by a wire are
 * added even before the template's ports have loaded, so no wire is hidden.
 */
export function describeGraph(input: GraphInput): {
  nodes: NodeSpec[];
  wires: WireSpec[];
} {
  const {
    selectedTemplates,
    externalTemplates,
    constants,
    templatePorts,
    wiring,
  } = input;

  const templateIds = new Set(selectedTemplates.map((t) => t.id));
  const externalIds = new Set(externalTemplates.map((t) => t.id));
  const constantIds = new Set(constants.map((c) => c.id));

  const wiredInputs = new Map<string, Set<string>>();
  const wiredConfigsIn = new Map<string, Set<string>>();
  const wiredOutputs = new Map<string, Set<string>>();
  const wiredConfigsOut = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, id: string, name: string) => {
    if (!m.has(id)) m.set(id, new Set());
    m.get(id)!.add(name);
  };
  const onCanvas = (w: WiringRule) =>
    templateIds.has(w.target_template_id) &&
    (templateIds.has(w.source_template_id) ||
      externalIds.has(w.source_template_id) ||
      constantIds.has(w.source_template_id));
  for (const w of wiring) {
    if (!onCanvas(w)) continue;
    if (w.target_type === "dependency_config") {
      add(wiredConfigsIn, w.target_template_id, w.target_variable);
    } else {
      add(wiredInputs, w.target_template_id, w.target_variable);
    }
    if (w.source_type === "dependency_config") {
      add(wiredConfigsOut, w.source_template_id, w.source_output);
    } else {
      add(wiredOutputs, w.source_template_id, w.source_output);
    }
  }

  const portsOf = (id: string) => {
    const ports = templatePorts[id];
    const configs = unique([
      ...(ports?.configs ?? []),
      ...(wiredConfigsIn.get(id) ?? []),
      ...(wiredConfigsOut.get(id) ?? []),
    ]);
    return {
      inputs: unique([
        ...(ports?.inputs ?? []),
        ...(wiredInputs.get(id) ?? []),
      ]),
      outputs: unique([
        ...(ports?.outputs ?? []),
        ...(wiredOutputs.get(id) ?? []),
      ]),
      configs,
      inputMeta: ports?.inputMeta ?? {},
    };
  };

  const nodes: NodeSpec[] = [];

  for (const t of externalTemplates) {
    const ports = portsOf(t.id);
    nodes.push({
      id: nodeIdOf("external", t.id),
      kind: "external",
      entityId: t.id,
      title: t.name,
      abstract: t.abstract,
      // An existing resource is only a source: no inputs, config is read-only
      inputs: [],
      outputs: [
        ...ports.outputs.map(outputPort),
        ...ports.configs.map(configOutPort),
      ],
    });
  }

  for (const c of constants) {
    nodes.push({
      id: nodeIdOf("constant", c.id),
      kind: "constant",
      entityId: c.id,
      title: c.name,
      inputs: [],
      outputs: [
        { key: CONSTANT_OUTPUT_KEY, name: c.name || "value", kind: "output" },
      ],
      constantType: c.type,
      defaultValue: c.defaultValue,
    });
  }

  for (const t of selectedTemplates) {
    const ports = portsOf(t.id);
    nodes.push({
      id: nodeIdOf("template", t.id),
      kind: "template",
      entityId: t.id,
      title: t.name,
      abstract: t.abstract,
      inputs: [
        ...ports.inputs.map((name) => inputPort(name, ports.inputMeta[name])),
        ...ports.configs.map(configInPort),
      ],
      outputs: [
        ...ports.outputs.map(outputPort),
        ...ports.configs.map(configOutPort),
      ],
    });
  }

  // Wires the target template's source code configuration asks for
  const sourceRefs = new Set<string>();
  for (const t of selectedTemplates) {
    for (const ref of templatePorts[t.id]?.references ?? []) {
      sourceRefs.add(
        [ref.sourceTemplateId, ref.output, t.id, ref.input].join("|"),
      );
    }
  }
  const isFromSource = (rule: WiringRule) =>
    (rule.source_type ?? "output") === "output" &&
    (rule.target_type ?? "variable") === "variable" &&
    sourceRefs.has(
      [
        rule.source_template_id,
        rule.source_output,
        rule.target_template_id,
        rule.target_variable,
      ].join("|"),
    );

  const wires: WireSpec[] = [];
  const seen = new Set<string>();
  for (const rule of wiring) {
    if (!templateIds.has(rule.target_template_id)) continue;
    const isConstant = constantIds.has(rule.source_template_id);
    const sourceKind: WiringNodeKind | null = isConstant
      ? "constant"
      : externalIds.has(rule.source_template_id)
        ? "external"
        : templateIds.has(rule.source_template_id)
          ? "template"
          : null;
    if (!sourceKind) continue;

    const id = wiringRuleKey(rule);
    if (seen.has(id)) continue;
    seen.add(id);

    wires.push({
      id,
      rule,
      source: nodeIdOf(sourceKind, rule.source_template_id),
      sourceOutput: isConstant
        ? CONSTANT_OUTPUT_KEY
        : rule.source_type === "dependency_config"
          ? configOutPort(rule.source_output).key
          : outputPort(rule.source_output).key,
      target: rule.target_template_id,
      targetInput:
        rule.target_type === "dependency_config"
          ? configInPort(rule.target_variable).key
          : inputPort(rule.target_variable).key,
      fromSource: !isConstant && isFromSource(rule),
    });
  }

  wires.push(
    ...describeInherited(input, nodes, wiredInputs, {
      templateIds,
      externalIds,
    }),
  );

  return { nodes, wires };
}

/**
 * Inputs filled at run time by a template that is not on the canvas: a
 * resource takes outputs from every resource above it, not only its direct
 * parents. Adds a read-only node per such template to `nodes` and returns
 * the wires from it.
 */
function describeInherited(
  input: GraphInput,
  nodes: NodeSpec[],
  wiredInputs: Map<string, Set<string>>,
  ids: { templateIds: Set<string>; externalIds: Set<string> },
): WireSpec[] {
  const { selectedTemplates, externalTemplates, templatePorts } = input;
  const onCanvas = (id: string) =>
    ids.templateIds.has(id) || ids.externalIds.has(id);
  const nameOf = new Map(
    [...selectedTemplates, ...externalTemplates].map((t) => [t.id, t.name]),
  );

  const ghosts = new Map<
    string,
    { name: string; outputs: Set<string>; below: Set<string> }
  >();
  const wires: WireSpec[] = [];

  for (const t of selectedTemplates) {
    const ports = templatePorts[t.id];
    if (!ports?.references?.length) continue;
    const ancestors = ports.ancestors ?? [];
    const covered = new Set(wiredInputs.get(t.id));

    for (const ref of ports.references) {
      if (onCanvas(ref.sourceTemplateId)) continue;
      if (covered.has(ref.input) || !ports.inputs.includes(ref.input)) {
        continue;
      }
      const rows = ancestors.filter((a) => a.id === ref.sourceTemplateId);
      // Not above this template, so it would not fill the input
      if (rows.length === 0) continue;
      covered.add(ref.input);

      const ghost = ghosts.get(ref.sourceTemplateId) ?? {
        name: rows[0].name,
        outputs: new Set<string>(),
        below: new Set<string>(),
      };
      ghost.outputs.add(ref.output);
      for (const row of rows) {
        const child = nameOf.get(row.childId);
        if (child) ghost.below.add(child);
      }
      ghosts.set(ref.sourceTemplateId, ghost);

      const rule: WiringRule = {
        source_template_id: ref.sourceTemplateId,
        source_output: ref.output,
        target_template_id: t.id,
        target_variable: ref.input,
      };
      wires.push({
        id: `inherited|${wiringRuleKey(rule)}`,
        rule,
        source: nodeIdOf("ancestor", ref.sourceTemplateId),
        sourceOutput: outputPort(ref.output).key,
        target: t.id,
        targetInput: inputPort(ref.input).key,
        inherited: true,
        fromSource: true,
      });
    }
  }

  for (const [id, ghost] of ghosts) {
    nodes.push({
      id: nodeIdOf("ancestor", id),
      kind: "ancestor",
      entityId: id,
      title: ghost.name,
      note: ghost.below.size
        ? `Parent of ${[...ghost.below].join(", ")}`
        : "Further up the parent chain",
      inputs: [],
      outputs: [...ghost.outputs].map(outputPort),
    });
  }

  return wires;
}

/**
 * What the automatic layout depends on: the nodes, their port counts and
 * which nodes are connected. Port names are left out, so renaming a
 * constant (whose name is in its wires) does not re-arrange the canvas.
 */
export function layoutSignature(nodes: NodeSpec[], wires: WireSpec[]) {
  const links = [...new Set(wires.map((w) => `${w.source}>${w.target}`))];
  return JSON.stringify([
    nodes.map((n) => [n.id, n.inputs.length, n.outputs.length]),
    links.sort(),
  ]);
}

/** Wiring rule for a wire drawn from one port to another. */
export function ruleFromPorts(
  source: NodeSpec,
  sourceKey: string,
  target: NodeSpec,
  targetKey: string,
): WiringRule {
  const parsedTarget = parseTargetHandle(targetKey);
  // Constants have one output, named after the constant
  const parsedSource =
    source.kind === "constant"
      ? { name: source.title || "value", type: "output" as const }
      : parseSourceHandle(sourceKey);
  return {
    source_template_id: source.entityId,
    source_output: parsedSource.name,
    source_type: parsedSource.type,
    target_template_id: target.entityId,
    target_variable: parsedTarget.name,
    target_type: parsedTarget.type,
  };
}

/** Colour token for each port kind, shared by sockets, wires and labels. */
export const PORT_COLOR: Record<PortKind, string> = {
  input: "var(--color-info)",
  output: "var(--color-success)",
  config: "var(--color-secondary)",
};

export function portKindOfKey(key: string): PortKind {
  if (key.startsWith("config-")) return "config";
  if (key.startsWith("input-")) return "input";
  return "output";
}

/** What a wire is, which decides its colour. */
export type WireType =
  "output" | "config" | "constant" | "source" | "inherited";

/** Wire colours; mid-lightness so they read on light and dark canvases. */
export const WIRE_COLOR: Record<WireType, string> = {
  output: PORT_COLOR.output,
  config: PORT_COLOR.config,
  constant: "hsl(174, 72%, 38%)",
  source: "var(--color-tint-orange-500)",
  inherited: "hsl(330, 75%, 55%)",
};

export const WIRE_TYPE_LABEL: Record<WireType, string> = {
  output: "Output",
  config: "Dependency config",
  constant: "Constant",
  source: "Set by source code",
  inherited: "From a parent not on canvas",
};

/** Type of a wire, from its flags and source port. */
export function wireTypeOf(w: {
  sourceOutput: string;
  inherited?: boolean;
  fromSource?: boolean;
}): WireType {
  if (w.inherited) return "inherited";
  if (w.sourceOutput === CONSTANT_OUTPUT_KEY) return "constant";
  if (w.fromSource) return "source";
  return portKindOfKey(w.sourceOutput) === "config" ? "config" : "output";
}

/** Dash pattern of wires from ancestors that are not on the canvas. */
export const INHERITED_DASH = "6 4";

/** Hover label of a wire; `inheritedFrom` names the ancestor of an inherited wire. */
export const wireLabel = (
  output: string,
  input: string,
  opts: { inheritedFrom?: string; fromSource?: boolean } = {},
) =>
  `${output} → ${input}${
    opts.inheritedFrom
      ? ` · from ${opts.inheritedFrom}, not on canvas`
      : opts.fromSource
        ? " · set by source code"
        : ""
  }`;

export type WireFocus = "focus" | "dim" | "none";

/** Stroke of a wire: selected and focused wires stand out, dimmed ones fade. */
export function wireStroke(opts: {
  selected?: boolean;
  focus: WireFocus;
  inherited?: boolean;
}) {
  if (opts.selected || opts.focus === "focus") return { width: 3, opacity: 1 };
  if (opts.focus === "dim") return { width: 2, opacity: 0.12 };
  return { width: 2, opacity: opts.inherited ? 0.5 : 0.75 };
}
