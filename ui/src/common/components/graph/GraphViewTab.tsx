import "@xyflow/react/dist/base.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Edge,
  Handle,
  Node,
  NodeProps,
  OnNodesChange,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ReactFlowState,
  applyNodeChanges,
  useReactFlow,
  useStore,
  Viewport,
} from "@xyflow/react";

import {
  HeroArrowsPointingInIcon,
  HeroArrowsPointingOutIcon,
  HeroViewfinderCircleIcon,
} from "../../../icons";
import { IconButton, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";
import { fetchEntityTree } from "../tree/fetchEntityTree";
import { DEFAULT_TREE_DEPTH, TreeDepthSelect } from "../tree/TreeDepthSelect";
import { TreeResponse } from "../tree/types";
import {
  CanvasGrid,
  FlowZoomToolbar,
  paintGrid,
} from "../viewers/Wiring/CanvasChrome";

import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  GraphNodeData,
  GraphViewNode,
} from "./GraphViewNode";

const GRAPH_MIN_ZOOM = 0.1;
const GRAPH_MAX_ZOOM = 1.5;

/** Below this zoom nodes are plain boxes; the full card is unreadable anyway. */
const DETAIL_ZOOM = 0.55;

const LINK_COLOR = "var(--color-grey-400)";
const ACTIVE_LINK_COLOR = "var(--color-info)";

interface EntityNodeData extends GraphNodeData, Record<string, unknown> {
  /** Another node is active and this one is not its neighbour. */
  dimmed?: boolean;
}

type EntityFlowNode = Node<EntityNodeData, "entity">;

interface TreeGraphNode {
  data: GraphNodeData;
  position: { x: number; y: number };
}

const zoomedIn = (s: ReactFlowState) => s.transform[2] >= DETAIL_ZOOM;

// Links run from the right middle of a node to the left middle of the next;
// the handles only anchor them
const HIDDEN_HANDLE = {
  opacity: 0,
  pointerEvents: "none" as const,
  minWidth: 0,
  minHeight: 0,
  width: 1,
  height: 1,
  border: 0,
};

function EntityNodeView({ data }: NodeProps<EntityFlowNode>) {
  // Full cards only where they can be read; off-screen nodes are not
  // rendered at all (`onlyRenderVisibleElements`)
  const detail = useStore(zoomedIn);
  return (
    <div
      className="transition-opacity duration-150"
      style={{ opacity: data.dimmed ? 0.3 : undefined }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={HIDDEN_HANDLE}
      />
      <GraphViewNode data={{ ...data, detail }} />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={HIDDEN_HANDLE}
      />
    </div>
  );
}

const NODE_TYPES = { entity: EntityNodeView };
const PRO_OPTIONS = { hideAttribution: true };

const LEVEL_WIDTH = 320;
const NODE_HEIGHT = 90;

type Link = { source: string; target: string };

/**
 * Flattens the tree into graph nodes and links with a simple layered
 * (level-order) layout: each depth becomes a column (growing left-to-right),
 * and nodes within a level are stacked vertically. Good enough for
 * dependency graphs, which are rarely more than a few levels deep, and keeps
 * wide/bushy trees growing tall instead of very wide.
 */
function buildGraph(
  root: TreeResponse,
  entity_name: string,
): { nodes: TreeGraphNode[]; links: Link[] } {
  const nodes: TreeGraphNode[] = [];
  const links = new Map<string, Link>();
  // The tree repeats shared dependencies under every parent; the graph shows
  // each entity once, placed at its deepest occurrence so links flow forward.
  const entities = new Map<string, { node: TreeResponse; depth: number }>();

  const visit = (node: TreeResponse, depth: number, parentId?: string) => {
    const seen = entities.get(node.id);
    if (!seen || seen.depth < depth) entities.set(node.id, { node, depth });
    if (parentId) {
      links.set(`${parentId}->${node.id}`, {
        source: parentId,
        target: node.id,
      });
    }
    node.children?.forEach((child) => visit(child, depth + 1, node.id));
  };

  visit(root, 0);

  const levels: TreeResponse[][] = [];
  entities.forEach(({ node, depth }) => {
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
  });

  levels.forEach((levelNodes, depth) => {
    const columnHeight = levelNodes.length * NODE_HEIGHT;
    levelNodes.forEach((node, index) => {
      nodes.push({
        position: {
          x: depth * LEVEL_WIDTH,
          y: index * NODE_HEIGHT - columnHeight / 2,
        },
        data: {
          entity_name,
          entity_id: node.id,
          item: node,
          isRoot: depth === 0,
        },
      });
    });
  });

  return { nodes, links: [...links.values()] };
}

export interface GraphViewProps {
  entity_name: string;
  entity_id: string;
}

export const EntityGraphViewTab = (props: GraphViewProps) => (
  <ReactFlowProvider>
    <EntityGraphView {...props} />
  </ReactFlowProvider>
);

/**
 * Read-only view of an entity tree: drag, zoom and highlight only. Node
 * sizes are fixed so nothing is measured, and only visible nodes render.
 */
function EntityGraphView({ entity_id, entity_name }: GraphViewProps) {
  const { ikApi } = useConfig();
  const [tree, setTree] = useState<TreeResponse>();
  const [fullscreen, setFullscreen] = useState(false);
  const [depth, setDepth] = useState<number>(DEFAULT_TREE_DEPTH);
  // Panning and zooming repaint the grid directly, without a re-render
  const gridRef = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<EntityFlowNode>();

  useEffect(() => {
    fetchEntityTree(ikApi, entity_name, entity_id, "children", depth).then(
      setTree,
    );
  }, [entity_id, entity_name, ikApi, depth]);

  const data = useMemo(
    () => (tree ? buildGraph(tree, entity_name) : { nodes: [], links: [] }),
    [tree, entity_name],
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Hover wins while it lasts; otherwise the clicked (pinned) node stays highlighted.
  const activeId = hoveredId ?? pinnedId;

  /** Fit every node in view, never zooming in past 100%. */
  const fit = useCallback(async () => {
    // Let the store pick up new nodes first
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flow.fitView({ padding: 0.05, maxZoom: 1 });
  }, [flow]);

  // Positions are reset when the tree changes; drags stick until then
  const [nodes, setNodes] = useState<EntityFlowNode[]>([]);
  useEffect(() => {
    setNodes(
      data.nodes.map((n) => ({
        id: n.data.entity_id,
        type: "entity",
        position: n.position,
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
        data: { ...n.data },
      })),
    );
    if (data.nodes.length) void fit();
  }, [data, fit]);
  const onNodesChange: OnNodesChange<EntityFlowNode> = useCallback(
    (changes) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );

  // The active node is highlighted with its direct neighbours and the links
  // between them; everything else is dimmed.
  const neighbours = useMemo(() => {
    const ids = new Set<string>(activeId ? [activeId] : []);
    for (const l of data.links) {
      if (l.source === activeId) ids.add(l.target);
      if (l.target === activeId) ids.add(l.source);
    }
    return ids;
  }, [activeId, data]);

  // Only nodes whose highlight changed get a new object and re-render
  const shownCache = useRef(new Map<EntityFlowNode, EntityFlowNode>());
  const shownNodes = useMemo(() => {
    const cache = new Map<EntityFlowNode, EntityFlowNode>();
    const result = nodes.map((n) => {
      const highlighted = activeId !== null && neighbours.has(n.id);
      const dimmed = activeId !== null && !highlighted;
      const old = shownCache.current.get(n);
      const shown =
        old &&
        Boolean(old.data.highlighted) === highlighted &&
        Boolean(old.data.dimmed) === dimmed
          ? old
          : { ...n, data: { ...n.data, highlighted, dimmed } };
      cache.set(n, shown);
      return shown;
    });
    shownCache.current = cache;
    return result;
  }, [nodes, activeId, neighbours]);

  const edges = useMemo<Edge[]>(
    () =>
      data.links.map((l) => {
        const active = l.source === activeId || l.target === activeId;
        return {
          id: `${l.source}->${l.target}`,
          source: l.source,
          target: l.target,
          selectable: false,
          focusable: false,
          interactionWidth: 0,
          // Active links on top of the others
          zIndex: active ? 1 : 0,
          style: {
            stroke: active ? ACTIVE_LINK_COLOR : LINK_COLOR,
            strokeWidth: active ? 2 : 1.5,
            opacity: activeId !== null && !active ? 0.2 : undefined,
            transition: "opacity 150ms",
          },
        };
      }),
    [data, activeId],
  );

  const zoomBy = (factor: number) =>
    void flow.zoomTo(
      Math.min(
        GRAPH_MAX_ZOOM,
        Math.max(GRAPH_MIN_ZOOM, flow.getZoom() * factor),
      ),
    );

  const onMove = useCallback(
    (_: unknown, vp: Viewport) =>
      paintGrid(gridRef.current, { x: vp.x, y: vp.y, k: vp.zoom }),
    [],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Re-fit when the canvas changes size
  useEffect(() => {
    void fit();
  }, [fit, fullscreen]);

  return (
    <div
      // Full screen only changes classes, so the flow keeps its element and
      // its view
      className={cn(
        "overflow-hidden bg-canvas",
        fullscreen
          ? "fixed inset-0 z-1300 h-screen w-screen"
          : "relative h-120 w-full rounded-surface border border-divider",
      )}
    >
      <CanvasGrid gridRef={gridRef} />
      <div className="absolute inset-0 select-none">
        <ReactFlow<EntityFlowNode>
          nodes={shownNodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onNodeClick={(_, node) =>
            setPinnedId((current) => (current === node.id ? null : node.id))
          }
          onPaneClick={() => setPinnedId(null)}
          onMove={onMove}
          nodesConnectable={false}
          nodesDraggable
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements
          minZoom={GRAPH_MIN_ZOOM}
          maxZoom={GRAPH_MAX_ZOOM}
          proOptions={PRO_OPTIONS}
        />
      </div>
      <TreeDepthSelect
        value={depth}
        onChange={setDepth}
        className="absolute top-2 left-2 z-10"
      />
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Tooltip title="Fit to view">
          <IconButton
            className="border border-divider bg-paper hover:bg-hover"
            size="small"
            aria-label="Fit to view"
            onClick={() => void fit()}
          >
            <HeroViewfinderCircleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
          <IconButton
            className="border border-divider bg-paper hover:bg-hover"
            size="small"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? (
              <HeroArrowsPointingInIcon fontSize="small" />
            ) : (
              <HeroArrowsPointingOutIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </div>
      <FlowZoomToolbar
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
      />
    </div>
  );
}
