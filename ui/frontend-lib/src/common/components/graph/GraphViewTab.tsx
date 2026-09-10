import { useCallback, useEffect, useMemo, useState } from "react";

import { Box, useColorScheme } from "@mui/material";
import {
  applyNodeChanges,
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeChange,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useConfig } from "../../context";
import { fetchEntityTree } from "../tree/fetchEntityTree";
import { TreeResponse } from "../tree/types";

import { GraphNodeData, GraphViewNode } from "./GraphViewNode";

const COL_WIDTH = 260;
const ROW_HEIGHT = 140;

const NODE_TYPES = { graphNode: GraphViewNode };

/**
 * Flattens the tree into React Flow nodes/edges with a simple layered
 * (level-order) layout: each depth becomes a row, and nodes within a row are
 * spread out evenly. Good enough for dependency graphs, which are rarely
 * more than a few levels deep or extremely wide.
 */
function buildGraph(
  root: TreeResponse,
  entity_name: string,
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];
  const levels: TreeResponse[][] = [];

  const visit = (node: TreeResponse, depth: number, parentId?: string) => {
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);

    if (parentId) {
      edges.push({
        id: `${parentId}->${node.nodeId}`,
        source: parentId,
        target: node.nodeId,
        type: "default",
      });
    }

    node.children?.forEach((child) => visit(child, depth + 1, node.nodeId));
  };

  visit(root, 0);

  levels.forEach((levelNodes, depth) => {
    const rowWidth = levelNodes.length * COL_WIDTH;
    levelNodes.forEach((node, index) => {
      nodes.push({
        id: node.nodeId,
        type: "graphNode",
        position: {
          x: index * COL_WIDTH - rowWidth / 2,
          y: depth * ROW_HEIGHT,
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

  return { nodes, edges };
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
  const { mode } = useColorScheme();
  const [tree, setTree] = useState<TreeResponse>();

  useEffect(() => {
    fetchEntityTree(ikApi, entity_name, entity_id, "children").then(setTree);
  }, [entity_id, entity_name, ikApi]);

  const { nodes: computedNodes, edges } = useMemo(
    () => (tree ? buildGraph(tree, entity_name) : { nodes: [], edges: [] }),
    [tree, entity_name],
  );

  const [nodes, setNodes] = useState<Node<GraphNodeData>[]>(computedNodes);

  // Re-sync local node state whenever the fetched tree changes (e.g. entity
  // navigation), but let onNodesChange own positions afterwards so drags stick.
  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<GraphNodeData>>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: 480,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--template-surface-radius)",
        backgroundColor: "background.paper",
        overflow: "hidden",
      }}
    >
      {tree && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
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
    </Box>
  );
};
