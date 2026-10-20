import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyNodeChanges,
  Background,
  Controls,
  Edge,
  MiniMap,
  NodeChange,
  ReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  HeroArrowsPointingInIcon,
  HeroArrowsPointingOutIcon,
} from "../../../icons";
import {
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  useColorScheme,
} from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";
import { fetchEntityTree } from "../tree/fetchEntityTree";
import { DEFAULT_TREE_DEPTH, TreeDepthSelect } from "../tree/TreeDepthSelect";
import { TreeResponse } from "../tree/types";

import { GraphNode, GraphViewNode } from "./GraphViewNode";

const LEVEL_WIDTH = 320;
const NODE_HEIGHT = 90;

const NODE_TYPES = { graphNode: GraphViewNode };

/**
 * Flattens the tree into React Flow nodes/edges with a simple layered
 * (level-order) layout: each depth becomes a column (growing left-to-right),
 * and nodes within a level are stacked vertically. Good enough for
 * dependency graphs, which are rarely more than a few levels deep, and keeps
 * wide/bushy trees growing tall instead of very wide.
 */
function buildGraph(
  root: TreeResponse,
  entity_name: string,
): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphNode[] = [];
  const edges = new Map<string, Edge>();
  // The tree repeats shared dependencies under every parent; the graph shows
  // each entity once, placed at its deepest occurrence so edges flow forward.
  const entities = new Map<string, { node: TreeResponse; depth: number }>();

  const visit = (node: TreeResponse, depth: number, parentId?: string) => {
    const seen = entities.get(node.id);
    if (!seen || seen.depth < depth) entities.set(node.id, { node, depth });

    if (parentId) {
      const edgeId = `${parentId}->${node.id}`;
      edges.set(edgeId, {
        id: edgeId,
        source: parentId,
        target: node.id,
        type: "default",
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
        id: node.id,
        type: "graphNode",
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
        connectable: false,
      });
    });
  });

  return { nodes, edges: [...edges.values()] };
}

export interface GraphViewProps {
  entity_name: string;
  entity_id: string;
}

export const EntityGraphViewTab = ({
  entity_id,
  entity_name,
}: GraphViewProps) => {
  const { ikApi } = useConfig();
  const { resolvedMode: mode } = useColorScheme();
  const [tree, setTree] = useState<TreeResponse>();
  const [fullscreen, setFullscreen] = useState(false);
  const [depth, setDepth] = useState<number>(DEFAULT_TREE_DEPTH);

  useEffect(() => {
    fetchEntityTree(ikApi, entity_name, entity_id, "children", depth).then(
      setTree,
    );
  }, [entity_id, entity_name, ikApi, depth]);

  const { nodes: computedNodes, edges } = useMemo(
    () => (tree ? buildGraph(tree, entity_name) : { nodes: [], edges: [] }),
    [tree, entity_name],
  );

  const [nodes, setNodes] = useState<GraphNode[]>(computedNodes);

  // Re-sync local node state whenever the fetched tree changes (e.g. entity
  // navigation), but let onNodesChange own positions afterwards so drags stick.
  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Hover wins while it lasts; otherwise the clicked (pinned) node stays highlighted.
  const activeId = hoveredId ?? pinnedId;

  // The active node is highlighted with its direct neighbours and the edges
  // between them; everything else is dimmed.
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!activeId) return { displayNodes: nodes, displayEdges: edges };
    const neighbours = new Set<string>([activeId]);
    edges.forEach((edge) => {
      if (edge.source === activeId) neighbours.add(edge.target);
      if (edge.target === activeId) neighbours.add(edge.source);
    });
    const accent = mode === "dark" ? "#58a6ff" : "#0969da";
    return {
      displayNodes: nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: neighbours.has(node.id),
          dimmed: !neighbours.has(node.id),
        },
      })),
      displayEdges: edges.map((edge) => {
        const active = edge.source === activeId || edge.target === activeId;
        return {
          ...edge,
          zIndex: active ? 1 : 0,
          style: active ? { stroke: accent, strokeWidth: 2 } : { opacity: 0.2 },
        };
      }),
    };
  }, [activeId, nodes, edges, mode]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  const graph = (
    <div
      className={cn(
        fullscreen ? "h-[100vh]" : "h-120",
        fullscreen ? "rounded-none" : "rounded-surface",
        "relative w-full overflow-hidden border border-divider bg-paper",
      )}
    >
      {tree && (
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onNodeClick={(_, node) =>
            setPinnedId((current) => (current === node.id ? null : node.id))
          }
          onPaneClick={() => setPinnedId(null)}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          colorMode={mode === "dark" ? "dark" : "light"}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
          {nodes.length > 4 && (
            <MiniMap
              pannable
              zoomable
              nodeColor={mode === "dark" ? "#3d444d" : "#d0d7de"}
            />
          )}
        </ReactFlow>
      )}
      <TreeDepthSelect
        value={depth}
        onChange={setDepth}
        className="absolute top-2 left-2 z-10"
      />
      <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
        <IconButton
          className="absolute top-2 right-2 z-10 border border-divider bg-paper hover:bg-hover"
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
  );

  if (fullscreen) {
    return (
      <Dialog
        open
        fullScreen
        onClose={() => setFullscreen(false)}
        className="bg-canvas"
      >
        <DialogContent className="h-[100vh] p-0">{graph}</DialogContent>
      </Dialog>
    );
  }

  return graph;
};
