import { useMemo, useState } from "react";

import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useColorScheme,
  useTheme,
} from "@mui/material";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";

import { ConstantNode } from "./ConstantNode";
import { ExternalNode } from "./ExternalNode";
import { DiagramNode } from "./helpers";
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
  const { mode } = useColorScheme();
  const theme = useTheme();
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

  return (
    <Box
      sx={{
        width: "100%",
        height: isFullscreen ? "100vh" : 600,
        display: "flex",
        border: isFullscreen ? "none" : `1px solid ${theme.palette.divider}`,
        borderRadius: isFullscreen ? 0 : 2,
        overflow: "hidden",
        "& .react-flow__handle": {
          opacity: 1,
          visibility: "visible",
          pointerEvents: "all",
        },
        ...(isFullscreen && {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          background: theme.palette.background.default,
        }),
      }}
    >
      <WiringCanvasSidebar
        selectedIds={selectedIds}
        onAdd={onTemplateAdd}
        missingParentTemplates={missingParentTemplates}
        externalTemplateIds={externalTemplateIds}
        onExternalTemplateAdd={onExternalTemplateAdd}
        onConstantAdd={onConstantAdd}
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ReactFlow<DiagramNode>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          nodeDragThreshold={2}
          connectionLineStyle={{
            stroke: theme.palette.primary.main,
            strokeWidth: 2,
          }}
          proOptions={{ hideAttribution: true }}
          colorMode={mode === "dark" ? "dark" : "light"}
        >
          <Background gap={20} />
          <Controls />
          <Panel
            position="top-left"
            style={{
              background: theme.palette.background.paper,
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Drag templates from the sidebar or drag from a green{" "}
              <strong>output</strong> dot to a blue <strong>input</strong> dot
              to wire. Press <strong>Backspace</strong> to delete an edge.
            </Typography>
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
                  <FullscreenExitIcon fontSize="small" />
                ) : (
                  <FullscreenIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Panel>
        </ReactFlow>
      </Box>
    </Box>
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
