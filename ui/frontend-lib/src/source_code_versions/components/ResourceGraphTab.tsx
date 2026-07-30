import { useMemo, useState, useCallback } from "react";

import { Box, Typography, useColorScheme } from "@mui/material";
import {
  Background,
  Controls,
  Edge,
  MarkerType,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  parseSnapshotResources,
  SnapshotResource,
  topoPositions,
} from "./parseSnapshotResources";
import {
  ResourceDiagramNode,
  ResourceNode,
  ResourceNodeData,
  providerColor,
} from "./ResourceNode";

function transitiveReduce(
  resources: SnapshotResource[],
): Map<string, Set<string>> {
  const adj = new Map(resources.map((r) => [r.id, new Set(r.deps)]));
  const result = new Map<string, Set<string>>();
  for (const r of resources) {
    const keep = new Set<string>();
    for (const dep of adj.get(r.id) ?? []) {
      const visited = new Set<string>();
      const queue = [...(adj.get(r.id) ?? [])].filter((d) => d !== dep);
      let found = false;
      while (queue.length > 0 && !found) {
        const curr = queue.shift()!;
        if (curr === dep) {
          found = true;
          break;
        }
        if (visited.has(curr)) continue;
        visited.add(curr);
        queue.push(...(adj.get(curr) ?? []));
      }
      if (!found) keep.add(dep);
    }
    result.set(r.id, keep);
  }
  return result;
}

function remapDependencies(
  resources: SnapshotResource[],
  hiddenIds: Set<string>,
  regChildren: Map<string, string[]>,
): SnapshotResource[] {
  const resolve = (deps: string[], selfId: string, parentId: string | null) => {
    const out = new Set<string>();
    for (const dep of deps) {
      if (!hiddenIds.has(dep)) {
        out.add(dep);
        continue;
      }
      if (dep === parentId) continue;
      for (const child of regChildren.get(dep) ?? [])
        if (child !== selfId) out.add(child);
    }
    return [...out];
  };

  return resources.map((r) => ({
    ...r,
    deps: resolve(r.deps, r.id, r.parentModule),
  }));
}

function filterVisibleResources(
  rawResources: SnapshotResource[],
): SnapshotResource[] {
  const modulesWithChildren = new Set(
    rawResources
      .filter((r) => r.parentModule !== null)
      .map((r) => r.parentModule!),
  );
  const hiddenIds = new Set(
    rawResources
      .filter((r) => r.type === "module" && modulesWithChildren.has(r.id))
      .map((r) => r.id),
  );

  const regChildren = new Map<string, string[]>();
  for (const r of rawResources) {
    if (
      r.parentModule &&
      hiddenIds.has(r.parentModule) &&
      !hiddenIds.has(r.id)
    ) {
      const arr = regChildren.get(r.parentModule) ?? [];
      arr.push(r.id);
      regChildren.set(r.parentModule, arr);
    }
  }

  const visible = rawResources.filter((r) => !hiddenIds.has(r.id));
  return remapDependencies(visible, hiddenIds, regChildren);
}

function toGraphNodeViewModel(
  resource: SnapshotResource,
  hasIncoming: boolean,
  hasOutgoing: boolean,
): ResourceNodeData {
  return {
    headerLabel:
      resource.type === "module" ? `module.${resource.name}` : resource.type,
    subLabel:
      resource.type === "module"
        ? (resource.moduleSource ?? "")
        : resource.name,
    color: providerColor(resource.provider),
    isConditional: resource.isConditional ?? false,
    hasIncoming,
    hasOutgoing,
  };
}

function buildFlowModel(resources: SnapshotResource[]): {
  nodes: ResourceDiagramNode[];
  edges: Edge[];
} {
  const positions = topoPositions(resources);
  const byCol = new Map<number, string[]>();
  for (const r of resources) {
    const col = positions.get(r.id) ?? 0;
    const arr = byCol.get(col) ?? [];
    arr.push(r.id);
    byCol.set(col, arr);
  }

  const idSet = new Set(resources.map((r) => r.id));
  const nonRedundant = transitiveReduce(resources);

  const hasOutgoing = new Set(
    resources.flatMap((r) =>
      [...(nonRedundant.get(r.id) ?? [])].filter((d) => idSet.has(d)),
    ),
  );
  const hasIncoming = new Set(
    resources.flatMap((r) =>
      [...(nonRedundant.get(r.id) ?? [])]
        .filter((d) => idSet.has(d))
        .map(() => r.id),
    ),
  );

  const predMap = new Map<string, string[]>();
  for (const r of resources) {
    predMap.set(
      r.id,
      [...(nonRedundant.get(r.id) ?? [])].filter((d) => idSet.has(d)),
    );
  }

  const childCount = new Map<string, number>();
  for (const r of resources) {
    for (const dep of nonRedundant.get(r.id) ?? []) {
      if (idSet.has(dep)) childCount.set(dep, (childCount.get(dep) ?? 0) + 1);
    }
  }

  const idToPos = new Map<string, { x: number; y: number }>();
  const yOf = new Map<string, number>();
  [...byCol.keys()]
    .sort((a, b) => a - b)
    .forEach((col, ci) => {
      const ids = [...byCol.get(col)!];
      const avg = (id: string) => {
        const ps = predMap.get(id) ?? [];
        return ps.length
          ? ps.reduce((s, p) => s + (yOf.get(p) ?? 0), 0) / ps.length
          : 0;
      };
      ids.sort((a, b) => {
        const diff = (childCount.get(b) ?? 0) - (childCount.get(a) ?? 0);
        return diff !== 0 ? diff : ci > 0 ? avg(a) - avg(b) : 0;
      });
      ids.forEach((id, ri) => {
        const y = ri * ROW_H;
        idToPos.set(id, { x: ci * (COL_W + COL_GAP), y });
        yOf.set(id, y);
      });
    });

  const edges: Edge[] = resources.flatMap((r) =>
    [...(nonRedundant.get(r.id) ?? [])]
      .filter((dep) => idSet.has(dep))
      .map((dep) => ({
        id: `${dep}→${r.id}`,
        source: dep,
        sourceHandle: "out",
        target: r.id,
        targetHandle: "in",
        style: { stroke: "#326CE5", strokeWidth: 1.5, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#326CE5" },
      })),
  );

  const nodes: ResourceDiagramNode[] = resources.map((r) => ({
    id: r.id,
    type: "resourceNode",
    position: idToPos.get(r.id) ?? { x: 0, y: 0 },
    data: toGraphNodeViewModel(r, hasIncoming.has(r.id), hasOutgoing.has(r.id)),
  }));

  return { nodes, edges };
}

const COL_W = 280,
  COL_GAP = 100,
  ROW_H = 100;
const NODE_TYPES = { resourceNode: ResourceNode };

interface Props {
  codeSnapshot: string | null | undefined;
  sourceCodeFolder?: string;
  hideHeader?: boolean;
}

export const ResourceGraphTab = ({
  codeSnapshot,
  sourceCodeFolder,
  hideHeader,
}: Props) => {
  const { mode } = useColorScheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resources = useMemo(
    () =>
      filterVisibleResources(
        parseSnapshotResources(codeSnapshot ?? null, sourceCodeFolder),
      ),
    [codeSnapshot, sourceCodeFolder],
  );

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildFlowModel(resources),
    [resources],
  );

  const handleNodeClick = useCallback(
    (_: unknown, node: { id: string }) =>
      setSelectedId((prev) => (prev === node.id ? null : node.id)),
    [],
  );
  const handlePaneClick = useCallback(() => setSelectedId(null), []);

  const { nodes, edges } = useMemo(() => {
    if (!selectedId) return { nodes: baseNodes, edges: baseEdges };

    const outgoing = new Set(
      baseEdges.filter((e) => e.source === selectedId).map((e) => e.id),
    );
    const incoming = new Set(
      baseEdges.filter((e) => e.target === selectedId).map((e) => e.id),
    );
    const highlighted = new Set([
      ...baseEdges.filter((e) => e.source === selectedId).map((e) => e.target),
      ...baseEdges.filter((e) => e.target === selectedId).map((e) => e.source),
      selectedId,
    ]);

    return {
      nodes: baseNodes.map((n) => ({
        ...n,
        style: highlighted.has(n.id) ? {} : { opacity: 0.25 },
      })),
      edges: baseEdges.map((e) => ({
        ...e,
        style:
          outgoing.has(e.id) || incoming.has(e.id)
            ? { stroke: "#326CE5", strokeWidth: 2.5, opacity: 1 }
            : { stroke: "#326CE5", strokeWidth: 1.5, opacity: 0.08 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#326CE5" },
      })),
    };
  }, [baseNodes, baseEdges, selectedId]);

  if (!codeSnapshot)
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          No code snapshot available.
        </Typography>
      </Box>
    );

  if (resources.length === 0)
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          No Terraform resources found in snapshot.
        </Typography>
      </Box>
    );

  return (
    <Box>
      {!hideHeader && (
        <>
          <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
            Resource Plan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Resources that are planned to be provisioned for this source code
            version.
          </Typography>
        </>
      )}
      <Box
        sx={{
          width: "100%",
          height: 700,
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          colorMode={mode === "dark" ? "dark" : "light"}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Box>
    </Box>
  );
};
