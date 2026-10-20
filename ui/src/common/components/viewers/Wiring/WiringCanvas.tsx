import { useMemo, useState } from "react";

import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";

import {
  HeroArrowsPointingInIcon,
  HeroArrowsPointingOutIcon,
  HeroInformationCircleIcon,
} from "../../../../icons";
import { IconButton, Tooltip, useColorScheme } from "../../../../ui";
import { cn } from "../../../../utils/cn";

import { ConstantNode } from "./ConstantNode";
import { ExternalNode } from "./ExternalNode";
import { CANVAS_PALETTE, DiagramNode } from "./helpers";
import { TemplateNode } from "./TemplateNode";
import { useWiringCanvasGraph } from "./useWiringCanvasGraph";
import {
  createWiringCanvasStore,
  type WiringCanvasState,
} from "./useWiringCanvasStore";
import { WiringCanvasProps } from "./WiringCanvas.types";
import { WiringCanvasSidebar } from "./WiringCanvasSidebar";

const nodeTypes = {
  templateNode: TemplateNode,
  externalTemplateNode: ExternalNode,
  constantNode: ConstantNode,
};

const selector = (state: WiringCanvasState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
});

function WiringCanvasInner({
  selectedTemplates,
  wiring,
  onWiringChange,
  templatePorts,
  onTemplateAdd,
  onTemplateRemove,
  externalTemplates,
  onExternalTemplateAdd,
  onExternalTemplateRemove,
  missingParentTemplates,
  constants,
  onConstantAdd,
  onConstantRemove,
  onConstantUpdate,
  onConstantDefaultValueUpdate,
}: WiringCanvasProps) {
  const { resolvedMode: mode } = useColorScheme();
  const palette = CANVAS_PALETTE;
  const accent = palette.info.main;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // One Zustand store per WiringCanvas instance
  const useStore = useMemo(() => createWiringCanvasStore(), []);

  // Read nodes/edges and change handlers from Zustand store
  const { nodes, edges, onNodesChange, onEdgesChange } = useStore(
    useShallow(selector),
  );

  // Wiring-level callbacks + drag/drop + sidebar helpers
  const {
    onConnect,
    onEdgesDelete,
    handleDragOver,
    handleDrop,
    selectedIds,
    externalTemplateIds,
  } = useWiringCanvasGraph(
    {
      selectedTemplates,
      wiring,
      onWiringChange,
      templatePorts,
      onTemplateAdd,
      onTemplateRemove,
      externalTemplates,
      onExternalTemplateAdd,
      onExternalTemplateRemove,
      constants,
      onConstantRemove,
      onConstantUpdate,
      onConstantDefaultValueUpdate,
    },
    useStore,
  );

  // Thicken the stroke when selected, keeping its original color.
  const styledEdges = useMemo(
    () =>
      edges.map((edge) =>
        edge.selected
          ? {
              ...edge,
              style: {
                ...edge.style,
                strokeWidth:
                  (typeof edge.style?.strokeWidth === "number"
                    ? edge.style.strokeWidth
                    : 2) + 1.5,
              },
            }
          : edge,
      ),
    [edges],
  );

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden [&_.react-flow__handle]:[pointer-events:all] [&_.react-flow__handle]:visible [&_.react-flow__handle]:opacity-100",
        isFullscreen
          ? "fixed inset-0 z-1300 h-screen"
          : "h-[600px] rounded-surface border",
      )}
      style={
        isFullscreen
          ? { background: palette.background.default }
          : { borderColor: palette.divider }
      }
    >
      <WiringCanvasSidebar
        selectedIds={selectedIds}
        onAdd={onTemplateAdd}
        missingParentTemplates={missingParentTemplates}
        externalTemplateIds={externalTemplateIds}
        onExternalTemplateAdd={onExternalTemplateAdd}
        onConstantAdd={onConstantAdd}
      />
      <div className="min-w-0 flex-1">
        <ReactFlow<DiagramNode>
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          // Cap at 1: React Flow's fitView otherwise upscales to 2x.
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          nodeDragThreshold={2}
          connectionLineStyle={{
            stroke: accent,
            strokeWidth: 2,
          }}
          proOptions={{ hideAttribution: true }}
          colorMode={mode === "dark" ? "dark" : "light"}
        >
          <Background gap={20} />
          <Controls />
          <Panel
            position="top-right"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px",
            }}
          >
            <Tooltip
              title={
                <>
                  Drag templates from the sidebar or drag from a green{" "}
                  <strong>output</strong> dot to a blue <strong>input</strong>{" "}
                  dot to wire. Press <strong>Backspace</strong> to delete an
                  edge.
                </>
              }
              arrow
            >
              <HeroInformationCircleIcon
                className="cursor-help text-fg-muted"
                fontSize="small"
              />
            </Tooltip>
            <Tooltip
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              arrow
            >
              <IconButton
                size="small"
                onClick={() => setIsFullscreen((prev) => !prev)}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <HeroArrowsPointingInIcon fontSize="small" />
                ) : (
                  <HeroArrowsPointingOutIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export const WiringCanvas = (props: WiringCanvasProps) => {
  return (
    <ReactFlowProvider>
      <WiringCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export type { TemplatePorts } from "./WiringCanvas.types";
