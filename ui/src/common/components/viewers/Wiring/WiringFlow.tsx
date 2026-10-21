import "@xyflow/react/dist/base.css";

import {
  MouseEvent as ReactMouseEvent,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  applyNodeChanges,
  Connection,
  Edge,
  OnNodesChange,
  ReactFlow,
  useReactFlow,
  useStoreApi,
  Viewport as FlowViewport,
} from "@xyflow/react";

import { MAX_ZOOM, MIN_ZOOM, Point, Transform } from "./CanvasChrome";
import {
  NodeSpec,
  portKindOfKey,
  ruleFromPorts,
  WireFocus,
  WireSpec,
  wiringRuleKey,
} from "./graph";
import { packLayout } from "./layout";
import { WiringRule } from "./types";
import {
  WiringConnectionLine,
  WiringEdgeView,
  WiringFlowEdge,
} from "./WiringConnectionView";
import {
  WiringFlowNode,
  WiringNodeActions,
  WiringNodeActionsContext,
  WiringNodeView,
} from "./WiringNodeView";

/** A wire the user clicked, with the canvas point where they clicked. */
export interface SelectedWire {
  id: string;
  source: string;
  sourceOutput: string;
  target: string;
  targetInput: string;
  at: Point;
  /** Set by source code configuration, so it cannot be removed. */
  locked: boolean;
  /** From an ancestor that is not on the canvas. */
  inherited: boolean;
}

export interface WiringEditorHandlers {
  /** Wires the user drew or removed on the canvas. */
  onWiringEdit: (edit: { added: WiringRule[]; removed: string[] }) => void;
  onNodeRemove: (spec: NodeSpec) => void;
  onConstantChange: (
    constantId: string,
    patch: { name?: string; defaultValue?: string },
  ) => void;
  /** The user dragged a node. */
  onNodeMoved: () => void;
  onTransform: (transform: Transform) => void;
  onSelectionChange: (selection: {
    nodes: number;
    connection: boolean;
  }) => void;
  onWireSelect: (wire: SelectedWire | null) => void;
}

/** What the canvas around the editor can ask of it. */
export interface WiringEditor {
  /**
   * Show the given nodes and wires. Resolves, with the ids of nodes that
   * were added, once those nodes are rendered and measured.
   */
  sync: (nodes: NodeSpec[], wires: WireSpec[]) => Promise<string[]>;
  /**
   * Lay nodes out in the columns and order of `grid`, spaced by their
   * rendered size so tall nodes never overlap.
   */
  arrange: (grid: Record<string, Point>) => Promise<void>;
  /** Place new nodes: at their drop point, else right of the others. */
  place: (ids: string[], drops: Record<string, Point>) => Promise<void>;
  fit: () => Promise<void>;
  /** Zoom by `factor` around the centre of the viewport. */
  zoomBy: (factor: number) => Promise<void>;
  /** Canvas position under a pointer event, e.g. a drop. */
  pointerPosition: (event: { clientX: number; clientY: number }) => Point;
  /** Delete the selected wire, or ask to remove the selected nodes. */
  deleteSelection: () => void;
  removeConnection: (id: string) => void;
  /**
   * Wire free inputs and dependency configs to outputs, dependency configs
   * and constants with the same name. Returns how many wires were added,
   * and the targets (`Node.port`) skipped because several sources match.
   */
  autoWire: () => { added: number; ambiguous: string[] };
  clearSelection: () => void;
}

export interface WiringFlowProps {
  handlers: WiringEditorHandlers;
  /** View only: no wiring, removing or editing; nodes can still be moved. */
  readOnly?: boolean;
  ref?: Ref<WiringEditor>;
}

const NODE_TYPES = { wiring: WiringNodeView };
const EDGE_TYPES = { wiring: WiringEdgeView };
const MULTI_SELECT_KEYS = ["Control", "Meta"];
const PRO_OPTIONS = { hideAttribution: true };
const DEFAULT_SIZE = { width: 288, height: 160 };
const NO_KEYS = new Set<string>();

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Which port keys of each node have a wire. */
function wiredIndex(wires: WireSpec[]) {
  const index = new Map<string, Set<string>>();
  const keysOf = (id: string) => {
    let keys = index.get(id);
    if (!keys) index.set(id, (keys = new Set()));
    return keys;
  };
  for (const w of wires) {
    keysOf(w.source).add(w.sourceOutput);
    keysOf(w.target).add(w.targetInput);
  }
  return index;
}

/** Whether `to` is reached by following wires from `from`. */
function reaches(wires: WireSpec[], from: string, to: string) {
  const next = new Map<string, string[]>();
  for (const w of wires) {
    if (!next.has(w.source)) next.set(w.source, []);
    next.get(w.source)!.push(w.target);
  }
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return false;
}

/**
 * Whether a wire may go from `sourceKey` on `source` to `targetKey` on
 * `target`, given the wires already on the canvas.
 */
function canWire(
  specById: Map<string, NodeSpec>,
  wires: WireSpec[],
  c: {
    source: string;
    sourceKey?: string | null;
    target: string;
    targetKey?: string | null;
  },
) {
  const { sourceKey, targetKey } = c;
  if (!sourceKey || !targetKey || c.source === c.target) return false;
  const s = specById.get(c.source);
  const t = specById.get(c.target);
  if (!s || !t || t.kind !== "template") return false;
  // Ancestors are not on the canvas, so they cannot be wired by hand
  if (s.kind === "ancestor") return false;
  // An input set by source code configuration keeps that wire
  const locked = wires.some(
    (w) => w.fromSource && w.target === t.id && w.targetInput === targetKey,
  );
  if (locked) return false;
  // Outputs feed inputs; dependency configs feed dependency configs or inputs
  if (
    portKindOfKey(sourceKey) !== "config" &&
    portKindOfKey(targetKey) === "config"
  ) {
    return false;
  }
  // A template cannot depend on one that already depends on it
  if (reaches(wires, t.id, s.id)) return false;
  const key = wiringRuleKey(ruleFromPorts(s, sourceKey, t, targetKey));
  return !wires.some((w) => w.id === key);
}

/**
 * Wires every free template input and dependency config to the source with
 * the same name: an output, a dependency config, or a constant (by its
 * name). A source can feed many targets. Targets that already have a wire
 * are left alone, and so are targets that more than one source could feed.
 * `canWire` decides which pairs fit, e.g. only configs feed configs.
 */
function wiresByName(specById: Map<string, NodeSpec>, wires: WireSpec[]) {
  const sources = new Map<string, { node: NodeSpec; key: string }[]>();
  const addSource = (name: string, node: NodeSpec, key: string) => {
    const list = sources.get(name) ?? [];
    list.push({ node, key });
    sources.set(name, list);
  };
  for (const node of specById.values()) {
    if (node.kind === "constant") {
      const name = node.title.trim();
      const port = node.outputs[0];
      if (name && port) addSource(name, node, port.key);
      continue;
    }
    if (node.kind !== "template" && node.kind !== "external") continue;
    for (const port of node.outputs) addSource(port.name, node, port.key);
  }

  let current = wires;
  const added: WiringRule[] = [];
  const ambiguous: string[] = [];
  for (const target of specById.values()) {
    if (target.kind !== "template") continue;
    for (const input of target.inputs) {
      const taken = current.some(
        (w) => w.target === target.id && w.targetInput === input.key,
      );
      if (taken) continue;
      const candidates = (sources.get(input.name) ?? []).filter((o) =>
        canWire(specById, current, {
          source: o.node.id,
          sourceKey: o.key,
          target: target.id,
          targetKey: input.key,
        }),
      );
      if (candidates.length === 0) continue;
      if (candidates.length > 1) {
        ambiguous.push(`${target.title}.${input.name}`);
        continue;
      }
      const { node, key } = candidates[0];
      const rule = ruleFromPorts(node, key, target, input.key);
      added.push(rule);
      // Later checks (cycles, duplicates) see the wires added so far
      current = [
        ...current,
        {
          id: wiringRuleKey(rule),
          rule,
          source: node.id,
          sourceOutput: key,
          target: target.id,
          targetInput: input.key,
        },
      ];
    }
  }
  return { added, ambiguous };
}

type Rect = Point & { width: number; height: number };

/** Screen px kept free at the canvas edges, where the toolbars sit. */
const VIEW_MARGIN = 56;
/** Space kept between a placed node and its neighbours. */
const NODE_GAP = 32;

/**
 * Top-left corner for a node of `size`, nearest the centre of `view`
 * without overlapping `taken`. Looks outside the view only when the view is
 * full; falls back to the centre when there is no room nearby at all.
 */
function freeSpot(
  size: { width: number; height: number },
  view: Rect,
  taken: Rect[],
): { at: Point; inView: boolean } {
  const centre = {
    x: view.x + view.width / 2 - size.width / 2,
    y: view.y + view.height / 2 - size.height / 2,
  };
  const free = (p: Point) =>
    !taken.some(
      (r) =>
        p.x < r.x + r.width + NODE_GAP &&
        p.x + size.width + NODE_GAP > r.x &&
        p.y < r.y + r.height + NODE_GAP &&
        p.y + size.height + NODE_GAP > r.y,
    );
  const inView = (p: Point) =>
    p.x >= view.x &&
    p.y >= view.y &&
    p.x + size.width <= view.x + view.width &&
    p.y + size.height <= view.y + view.height;

  // Square rings around the centre, nearest first. The step grows with the
  // view, so zoomed out views stay quick to search.
  const extent = Math.max(view.width, view.height, size.width, size.height);
  const step = Math.max(16, extent / 48);
  const rings = Math.ceil((extent * 1.5) / step);
  let outside: Point | null = null;
  for (let ring = 0; ring <= rings; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const p = { x: centre.x + i * step, y: centre.y + j * step };
        if (!free(p)) continue;
        if (inView(p)) return { at: p, inView: true };
        outside ??= p;
      }
    }
    // Past the view: the nearest free spot outside it is the best there is
    if (outside && ring * step > extent / 2) break;
  }
  return outside
    ? { at: outside, inView: false }
    : { at: centre, inView: true };
}

/**
 * Wiring canvas on React Flow, shared by the blueprint editor and the
 * read-only diagram. Nodes and wires come in through `sync`; edits go out
 * through `handlers`, and only show once the parent passes them back in.
 * Render it inside a `ReactFlowProvider`, which the parent owns so its
 * toolbars and popovers can read the view from the store.
 */
export function WiringFlow({
  handlers,
  readOnly = false,
  ref,
}: WiringFlowProps) {
  const flow = useReactFlow<WiringFlowNode, WiringFlowEdge>();
  const store = useStoreApi<WiringFlowNode, WiringFlowEdge>();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [nodes, setNodes] = useState<WiringFlowNode[]>([]);
  const [specs, setSpecs] = useState<NodeSpec[]>([]);
  const [wires, setWires] = useState<WireSpec[]>([]);
  const [selectedWire, setSelectedWire] = useState<string | null>(null);

  // Latest values, for callbacks and the methods in the handle
  const specById = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs]);
  const specByIdRef = useRef(specById);
  specByIdRef.current = specById;
  const wiresRef = useRef(wires);
  wiresRef.current = wires;
  const selectedWireRef = useRef(selectedWire);
  selectedWireRef.current = selectedWire;
  /** Node ids of the last sync, to tell which nodes are new. */
  const syncedIds = useRef(new Set<string>());

  const selectWire = useCallback((id: string | null, at?: Point) => {
    const w = id ? wiresRef.current.find((w) => w.id === id) : undefined;
    selectedWireRef.current = w ? w.id : null;
    setSelectedWire(w ? w.id : null);
    if (!w) {
      handlersRef.current.onWireSelect(null);
    } else if (at) {
      handlersRef.current.onWireSelect({
        id: w.id,
        source: w.source,
        sourceOutput: w.sourceOutput,
        target: w.target,
        targetInput: w.targetInput,
        at,
        locked: Boolean(w.fromSource),
        inherited: Boolean(w.inherited),
      });
    }
  }, []);

  const unselectNodes = useCallback(
    () =>
      setNodes((ns) =>
        ns.some((n) => n.selected)
          ? ns.map((n) => (n.selected ? { ...n, selected: false } : n))
          : ns,
      ),
    [],
  );

  // Wires of the selected nodes are highlighted and the others dimmed
  const selectedKey = nodes
    .filter((n) => n.selected)
    .map((n) => n.id)
    .join("\n");
  const selectedIds = useMemo(
    () => new Set(selectedKey ? selectedKey.split("\n") : []),
    [selectedKey],
  );

  useEffect(() => {
    handlersRef.current.onSelectionChange({
      nodes: selectedIds.size,
      connection: selectedWire !== null,
    });
  }, [selectedIds, selectedWire]);

  // Edges whose look did not change keep their object, so they do not
  // re-render
  const edgeCache = useRef(new Map<string, WiringFlowEdge>());
  const edges = useMemo(() => {
    const cache = new Map<string, WiringFlowEdge>();
    const result = wires.map((w) => {
      const focus: WireFocus =
        selectedIds.size === 0
          ? "none"
          : selectedIds.has(w.source) || selectedIds.has(w.target)
            ? "focus"
            : "dim";
      const selected = w.id === selectedWire;
      const sourceTitle = specById.get(w.source)?.title ?? "";
      const old = edgeCache.current.get(w.id);
      const edge: WiringFlowEdge =
        old &&
        old.data?.rule === w.rule &&
        old.data.focus === focus &&
        old.data.color === w.color &&
        old.data.locked === Boolean(w.fromSource) &&
        old.data.sourceTitle === sourceTitle &&
        old.selected === selected &&
        old.source === w.source &&
        old.target === w.target
          ? old
          : {
              id: w.id,
              type: "wiring",
              source: w.source,
              target: w.target,
              sourceHandle: w.sourceOutput,
              targetHandle: w.targetInput,
              selectable: false,
              focusable: false,
              deletable: false,
              selected,
              data: {
                rule: w.rule,
                inherited: Boolean(w.inherited),
                locked: Boolean(w.fromSource),
                color: w.color,
                focus,
                sourceTitle,
              },
            };
      cache.set(w.id, edge);
      return edge;
    });
    edgeCache.current = cache;
    return result;
  }, [wires, selectedIds, selectedWire, specById]);

  const isValidConnection = useCallback(
    (c: Connection | Edge) =>
      canWire(specByIdRef.current, wiresRef.current, {
        source: c.source,
        sourceKey: c.sourceHandle,
        target: c.target,
        targetKey: c.targetHandle,
      }),
    [],
  );

  const onConnect = useCallback((c: Connection) => {
    const s = specByIdRef.current.get(c.source);
    const t = specByIdRef.current.get(c.target);
    if (!s || !t || !c.sourceHandle || !c.targetHandle) return;
    const rule = ruleFromPorts(s, c.sourceHandle, t, c.targetHandle);
    // An input takes one value, so a new wire replaces the old one
    const removed = wiresRef.current
      .filter(
        (w) =>
          w.target === t.id &&
          w.targetInput === c.targetHandle &&
          !w.inherited &&
          !w.fromSource,
      )
      .map((w) => w.id);
    handlersRef.current.onWiringEdit({ added: [rule], removed });
  }, []);

  const onNodesChange: OnNodesChange<WiringFlowNode> = useCallback(
    (changes) => {
      // Picking a node drops the wire selection
      if (
        selectedWireRef.current &&
        changes.some((c) => c.type === "select" && c.selected)
      ) {
        selectWire(null);
      }
      setNodes((ns) => applyNodeChanges(changes, ns));
    },
    [selectWire],
  );

  const onEdgeClick = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      unselectNodes();
      selectWire(
        edge.id,
        flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      );
    },
    [flow, selectWire, unselectNodes],
  );

  const onMove = useCallback(
    (_: unknown, vp: FlowViewport) =>
      handlersRef.current.onTransform({ x: vp.x, y: vp.y, k: vp.zoom }),
    [],
  );

  const actions = useMemo<WiringNodeActions>(
    () => ({
      readOnly,
      removeNode: (id) => {
        const spec = specByIdRef.current.get(id);
        if (spec) handlersRef.current.onNodeRemove(spec);
      },
      toggleExpanded: (id) =>
        setNodes((ns) =>
          ns.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, expanded: !n.data.expanded } }
              : n,
          ),
        ),
      changeConstant: (id, patch) =>
        handlersRef.current.onConstantChange(id, patch),
    }),
    [readOnly],
  );

  // Calls from the parent run one at a time, in order
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const disposed = useRef(false);
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
    };
  }, []);

  const api = useMemo<WiringEditor>(() => {
    const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
      const run = () => (disposed.current ? (undefined as T) : task());
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => undefined);
      return next;
    };

    const sizeOf = (id: string) => {
      const m = flow.getInternalNode(id)?.measured;
      return {
        width: m?.width || DEFAULT_SIZE.width,
        height: m?.height || DEFAULT_SIZE.height,
      };
    };

    /** Wait until the given nodes have a size, and the store has caught up. */
    const measured = async (ids: string[]) => {
      // About a second at most, so a node that never renders cannot block
      for (let i = 0; i < 60; i++) {
        await nextFrame();
        if (ids.every((id) => flow.getInternalNode(id)?.measured.width)) {
          return;
        }
      }
    };

    const moveNodes = async (positions: Record<string, Point>) => {
      setNodes((ns) =>
        ns.map((n) =>
          positions[n.id] ? { ...n, position: positions[n.id] } : n,
        ),
      );
      await nextFrame();
    };

    const removeConnection = (id: string) => {
      const w = wiresRef.current.find((w) => w.id === id);
      if (!w || w.fromSource || w.inherited) return;
      handlersRef.current.onWiringEdit({ added: [], removed: [id] });
    };

    return {
      sync: (nextSpecs, nextWires) =>
        enqueue(async () => {
          const added = nextSpecs
            .map((s) => s.id)
            .filter((id) => !syncedIds.current.has(id));
          syncedIds.current = new Set(nextSpecs.map((s) => s.id));
          const wired = wiredIndex(nextWires);

          setSpecs(nextSpecs);
          setWires(nextWires);
          wiresRef.current = nextWires;
          setNodes((prev) => {
            const byId = new Map(prev.map((n) => [n.id, n]));
            return nextSpecs.map((spec): WiringFlowNode => {
              const keys = wired.get(spec.id) ?? NO_KEYS;
              const wiredKey = [...keys].sort().join("\n");
              const old = byId.get(spec.id);
              if (!old) {
                return {
                  id: spec.id,
                  type: "wiring",
                  position: { x: 0, y: 0 },
                  data: { spec, wired: keys, wiredKey, expanded: false },
                };
              }
              // Unchanged nodes keep their object, so they do not re-render
              const sameSpec =
                old.data.spec === spec ||
                JSON.stringify(old.data.spec) === JSON.stringify(spec);
              if (sameSpec && old.data.wiredKey === wiredKey) return old;
              return {
                ...old,
                data: { ...old.data, spec, wired: keys, wiredKey },
              };
            });
          });

          const current = selectedWireRef.current;
          if (current && !nextWires.some((w) => w.id === current)) {
            selectWire(null);
          }

          await measured(added);
          return added;
        }).then((added) => added ?? []),

      arrange: (grid) =>
        enqueue(async () => {
          const onCanvas = Object.fromEntries(
            Object.entries(grid).filter(([id]) => flow.getInternalNode(id)),
          );
          await moveNodes(packLayout(onCanvas, sizeOf));
        }),

      place: (ids, drops) =>
        enqueue(async () => {
          const placing = new Set(ids);
          const taken: Rect[] = [];
          for (const n of flow.getNodes()) {
            if (placing.has(n.id)) continue;
            const node = flow.getInternalNode(n.id);
            if (!node) continue;
            taken.push({ ...node.internals.positionAbsolute, ...sizeOf(n.id) });
          }
          const positions: Record<string, Point> = {};
          // Dropped nodes stay where they were dropped
          for (const id of ids) {
            const drop = drops[id];
            if (!drop) continue;
            positions[id] = drop;
            taken.push({ ...drop, ...sizeOf(id) });
          }

          // The others go to a free spot in view, nearest its centre;
          // ancestors last, so the nodes the user added sit in the middle
          const { width, height } = store.getState();
          const { x, y, zoom } = flow.getViewport();
          const margin = VIEW_MARGIN / zoom;
          const view = {
            x: -x / zoom + margin,
            y: -y / zoom + margin,
            width: Math.max(0, width / zoom - 2 * margin),
            height: Math.max(0, height / zoom - 2 * margin),
          };
          const isAncestor = (id: string) =>
            flow.getNode(id)?.data.spec.kind === "ancestor";
          const rest = ids.filter((id) => !drops[id]);
          let outOfView: Rect | null = null;
          for (const id of [
            ...rest.filter((id) => !isAncestor(id)),
            ...rest.filter(isAncestor),
          ]) {
            const size = sizeOf(id);
            const spot = freeSpot(size, view, taken);
            positions[id] = spot.at;
            taken.push({ ...spot.at, ...size });
            if (!spot.inView && !outOfView) outOfView = { ...spot.at, ...size };
          }
          await moveNodes(positions);
          // No room in view: bring the first node that did not fit into it
          if (outOfView) {
            await flow.setCenter(
              outOfView.x + outOfView.width / 2,
              outOfView.y + outOfView.height / 2,
              { zoom },
            );
          }
        }),

      fit: () =>
        enqueue(async () => {
          if (flow.getNodes().length === 0) {
            await flow.setViewport({ x: 0, y: 0, zoom: 1 });
            return;
          }
          await flow.fitView({ padding: 0.1, maxZoom: 1 });
        }),

      zoomBy: async (factor) => {
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, flow.getZoom() * factor),
        );
        await flow.zoomTo(next);
      },

      pointerPosition: (event) =>
        flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),

      deleteSelection: () => {
        const id = selectedWireRef.current;
        if (id) {
          removeConnection(id);
          return;
        }
        for (const n of flow.getNodes()) {
          if (n.selected) handlersRef.current.onNodeRemove(n.data.spec);
        }
      },

      removeConnection,

      autoWire: () => {
        const { added, ambiguous } = wiresByName(
          specByIdRef.current,
          wiresRef.current,
        );
        if (added.length) {
          handlersRef.current.onWiringEdit({ added, removed: [] });
        }
        return { added: added.length, ambiguous };
      },

      clearSelection: () => {
        unselectNodes();
        selectWire(null);
      },
    };
  }, [flow, store, selectWire, unselectNodes]);

  useImperativeHandle(ref, () => api, [api]);

  return (
    <WiringNodeActionsContext.Provider value={actions}>
      <div className="absolute inset-0 select-none">
        <ReactFlow<WiringFlowNode, WiringFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          connectionLineComponent={WiringConnectionLine}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => selectWire(null)}
          onNodeDragStop={() => handlersRef.current.onNodeMoved()}
          onMove={onMove}
          onInit={(instance) => {
            const { x, y, zoom } = instance.getViewport();
            handlersRef.current.onTransform({ x, y, k: zoom });
          }}
          nodesConnectable={!readOnly}
          nodesDraggable
          elementsSelectable
          deleteKeyCode={null}
          multiSelectionKeyCode={MULTI_SELECT_KEYS}
          zoomOnDoubleClick={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          proOptions={PRO_OPTIONS}
        />
      </div>
    </WiringNodeActionsContext.Provider>
  );
}
