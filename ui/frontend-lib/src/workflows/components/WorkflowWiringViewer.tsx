import React, { useEffect, useMemo, useState } from "react";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
  useColorScheme,
  useTheme,
} from "@mui/material";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  MarkerType,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { GetReferenceUrlValue } from "../../common/components/CommonField";
import { TemplateShort } from "../../templates/types";
import { EntityMeta } from "../hooks/useWorkflowMetadata";
import { WiringRule, WorkflowStepResponse } from "../types";

// ── Status color helpers ──────────────────────────────────────────────────

type StepStatus = WorkflowStepResponse["status"];

const statusColorMap: Record<
  StepStatus,
  "success" | "error" | "info" | "warning" | "default"
> = {
  done: "success",
  error: "error",
  in_progress: "info",
  pending: "default",
  cancelled: "warning",
};

const statusIcon: Record<StepStatus, React.ReactNode> = {
  done: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
  error: <ErrorOutlineIcon sx={{ fontSize: 16 }} />,
  in_progress: <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />,
  pending: <HourglassEmptyIcon sx={{ fontSize: 16 }} />,
  cancelled: <ErrorOutlineIcon sx={{ fontSize: 16 }} />,
};

function useStatusColors(status: StepStatus | undefined) {
  const theme = useTheme();
  if (!status || status === "pending") {
    return {
      border: theme.palette.divider,
      header: theme.palette.grey[600],
      headerText: theme.palette.getContrastText(theme.palette.grey[600]),
    };
  }
  const palette =
    status === "done"
      ? theme.palette.success
      : status === "error"
        ? theme.palette.error
        : status === "in_progress"
          ? theme.palette.info
          : theme.palette.warning;
  return {
    border: palette.main,
    header: palette.main,
    headerText: palette.contrastText,
  };
}

// ── Node data ─────────────────────────────────────────────────────────────

interface WorkflowNodeData {
  label: string;
  templateId: string;
  outputs: string[];
  inputs: string[];
  status?: StepStatus;
  errorMessage?: string | null;
  resourceId?: string | null;
  resourceName?: string;
  position?: number;
  nodeKind: "template" | "external" | "constant";
  [key: string]: unknown;
}

type WorkflowNodeType = Node<WorkflowNodeData>;

// ── Template node ─────────────────────────────────────────────────────────

function WorkflowTemplateNode({ data }: NodeProps<WorkflowNodeType>) {
  const theme = useTheme();
  const colors = useStatusColors(data.status);

  const handleStyle = (color: string): React.CSSProperties => ({
    position: "relative",
    transform: "none",
    top: "auto",
    left: "auto",
    right: "auto",
    width: 10,
    height: 10,
    minWidth: 10,
    minHeight: 10,
    background: color,
    border: `2px solid ${theme.palette.background.paper}`,
    borderRadius: "50%",
    flexShrink: 0,
  });

  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        border: `2px solid ${colors.border}`,
        borderRadius: 2,
        minWidth: 240,
        maxWidth: 300,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: colors.header,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        {data.position != null && (
          <Chip
            label={data.position + 1}
            size="small"
            sx={{
              fontWeight: 700,
              minWidth: 24,
              height: 20,
              bgcolor: "rgba(255,255,255,0.25)",
              color: colors.headerText,
              fontSize: 11,
            }}
          />
        )}
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: colors.headerText,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.label}
        </Typography>
        {data.status && (
          <Chip
            icon={statusIcon[data.status] as React.ReactElement}
            label={data.status.replace("_", " ").toUpperCase()}
            size="small"
            color={statusColorMap[data.status]}
            sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
          />
        )}
      </Box>

      {/* Resource link */}
      {data.resourceId && (
        <Box
          sx={{
            px: 1.5,
            pt: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Resource:
          </Typography>
          <GetReferenceUrlValue
            id={data.resourceId}
            _entity_name="resource"
            identifier={data.resourceName ?? data.resourceId.slice(0, 8) + "…"}
          />
        </Box>
      )}

      {/* Error */}
      {data.errorMessage && (
        <Tooltip title={data.errorMessage} arrow>
          <Box
            sx={{
              mx: 1.5,
              mt: 0.75,
              p: 0.75,
              bgcolor: "error.main",
              color: "error.contrastText",
              borderRadius: 0.5,
              fontSize: 11,
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "help",
            }}
          >
            {data.errorMessage}
          </Box>
        </Tooltip>
      )}

      {/* Ports */}
      <Box sx={{ display: "flex", gap: 2, p: 1.5 }}>
        {data.inputs.length > 0 && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, display: "block", mb: 0.5 }}
            >
              Inputs
            </Typography>
            {data.inputs.map((input) => (
              <Box
                key={`in-${input}`}
                sx={{ display: "flex", alignItems: "center", my: 0.4 }}
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`input-${input}`}
                  style={{
                    ...handleStyle(theme.palette.info.main),
                    marginRight: 4,
                  }}
                />
                <Chip
                  label={input}
                  size="small"
                  variant="outlined"
                  color="info"
                  sx={{ fontSize: 11 }}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`input-source-${input}`}
                  style={{
                    ...handleStyle(theme.palette.info.light),
                    marginLeft: 4,
                    width: 7,
                    height: 7,
                    minWidth: 7,
                    minHeight: 7,
                  }}
                />
              </Box>
            ))}
          </Box>
        )}

        {data.outputs.length > 0 && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                display: "block",
                mb: 0.5,
                textAlign: "right",
              }}
            >
              Outputs
            </Typography>
            {data.outputs.map((output) => (
              <Box
                key={`out-${output}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  my: 0.4,
                }}
              >
                <Chip
                  label={output}
                  size="small"
                  variant="outlined"
                  color="success"
                  sx={{ fontSize: 11 }}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output-${output}`}
                  style={{
                    ...handleStyle(theme.palette.success.main),
                    marginLeft: 4,
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── External (input) node ─────────────────────────────────────────────────

function WorkflowExternalNode({ data }: NodeProps<WorkflowNodeType>) {
  const theme = useTheme();
  const colors = useStatusColors(data.status);

  const handleStyle = (color: string): React.CSSProperties => ({
    position: "relative",
    transform: "none",
    top: "auto",
    left: "auto",
    right: "auto",
    width: 10,
    height: 10,
    minWidth: 10,
    minHeight: 10,
    background: color,
    border: `2px solid ${theme.palette.background.paper}`,
    borderRadius: "50%",
    flexShrink: 0,
  });

  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        border: `2px dashed ${colors.border}`,
        borderRadius: 2,
        minWidth: 220,
        boxShadow: theme.shadows[2],
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: colors.header,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <StorageIcon fontSize="small" sx={{ color: colors.headerText }} />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: colors.headerText }}
        >
          {data.label}
        </Typography>
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Chip
          label="Input"
          size="small"
          variant="outlined"
          color="warning"
          sx={{ mb: 0.5 }}
        />
        {data.outputs.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {data.outputs.map((output) => (
              <Box
                key={`out-${output}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  my: 0.4,
                }}
              >
                <Chip
                  label={output}
                  size="small"
                  variant="outlined"
                  color="success"
                  sx={{ fontSize: 11 }}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output-${output}`}
                  style={{
                    ...handleStyle(theme.palette.success.main),
                    marginLeft: 4,
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Constant node ─────────────────────────────────────────────────────────

function WorkflowConstantNode({ data }: NodeProps<WorkflowNodeType>) {
  const theme = useTheme();

  const handleStyle = (color: string): React.CSSProperties => ({
    position: "relative",
    transform: "none",
    top: "auto",
    left: "auto",
    right: "auto",
    width: 10,
    height: 10,
    minWidth: 10,
    minHeight: 10,
    background: color,
    border: `2px solid ${theme.palette.background.paper}`,
    borderRadius: "50%",
    flexShrink: 0,
  });

  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        border: `2px solid ${theme.palette.secondary.main}`,
        borderRadius: 2,
        minWidth: 220,
        boxShadow: theme.shadows[2],
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.secondary.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <TuneIcon
          fontSize="small"
          sx={{ color: theme.palette.secondary.contrastText }}
        />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: theme.palette.secondary.contrastText }}
        >
          {data.label}
        </Typography>
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Chip
          label="Constant"
          size="small"
          variant="outlined"
          color="secondary"
          sx={{ mb: 0.5 }}
        />
        {data.outputs.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {data.outputs.map((output) => (
              <Box
                key={`out-${output}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  my: 0.4,
                }}
              >
                <Chip
                  label={output}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: 11 }}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output-${output}`}
                  style={{
                    ...handleStyle(theme.palette.secondary.main),
                    marginLeft: 4,
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Node types registry ───────────────────────────────────────────────────

const nodeTypes = {
  workflowTemplate: WorkflowTemplateNode,
  workflowExternal: WorkflowExternalNode,
  workflowConstant: WorkflowConstantNode,
};

// ── Props ─────────────────────────────────────────────────────────────────

interface WorkflowWiringViewerProps {
  templates: TemplateShort[];
  wiring: WiringRule[];
  steps: WorkflowStepResponse[];
  resources?: Map<string, EntityMeta>;
  height?: number;
}

export const WorkflowWiringViewer = ({
  templates,
  wiring,
  steps,
  resources,
  height = 500,
}: WorkflowWiringViewerProps) => {
  const theme = useTheme();
  const { mode } = useColorScheme();
  const [fullscreen, setFullscreen] = useState(false);

  // Build lookup: template_id → step
  const stepByTemplate = useMemo(() => {
    const m = new Map<string, WorkflowStepResponse>();
    for (const s of steps) m.set(s.template_id, s);
    return m;
  }, [steps]);

  // Identify template IDs that are in the wiring but NOT in the blueprint templates.
  // These are external resources providing inputs to the workflow.
  const externalIds = useMemo(() => {
    const templateIdSet = new Set(templates.map((t) => t.id));
    const ext = new Set<string>();

    for (const w of wiring) {
      if (!templateIdSet.has(w.source_template_id)) {
        ext.add(w.source_template_id);
      }
    }
    return ext;
  }, [templates, wiring]);

  // No constant IDs in workflow view — all non-template sources are external resources
  const constantIds = useMemo(() => new Set<string>(), []);

  // Derive ports from wiring
  const portsByTemplate = useMemo(() => {
    const m: Record<string, { inputs: Set<string>; outputs: Set<string> }> = {};
    const ensure = (id: string) => {
      if (!m[id]) m[id] = { inputs: new Set(), outputs: new Set() };
    };

    for (const t of templates) ensure(t.id);
    for (const id of externalIds) ensure(id);
    for (const id of constantIds) ensure(id);

    for (const w of wiring) {
      const isConstant = constantIds.has(w.source_template_id);
      const isInput = !isConstant && w.source_output.startsWith("input:");

      if (isConstant) {
        m[w.source_template_id]?.outputs.add(w.source_output);
      } else if (isInput) {
        m[w.source_template_id]?.inputs.add(w.source_output.slice(6));
      } else {
        m[w.source_template_id]?.outputs.add(w.source_output);
      }
      ensure(w.target_template_id);
      m[w.target_template_id]?.inputs.add(w.target_variable);
    }

    const result: Record<string, { inputs: string[]; outputs: string[] }> = {};
    for (const [id, sets] of Object.entries(m)) {
      result[id] = { inputs: [...sets.inputs], outputs: [...sets.outputs] };
    }
    return result;
  }, [templates, externalIds, constantIds, wiring]);

  // Build nodes — arranged left-to-right by position (level)
  const nodes: WorkflowNodeType[] = useMemo(() => {
    const extArr = [...externalIds];
    const constArr = [...constantIds];
    const COL_WIDTH = 360;
    const ROW_HEIGHT = 280;

    // External and constant nodes go to column -1 (leftmost)
    const extNodes: WorkflowNodeType[] = extArr.map((id, i) => {
      const step = stepByTemplate.get(id);
      return {
        id: `ext-${id}`,
        type: "workflowExternal",
        position: { x: 0, y: 40 + i * ROW_HEIGHT },
        data: {
          label: id.slice(0, 8) + "…",
          templateId: id,
          outputs: portsByTemplate[id]?.outputs || [],
          inputs: [],
          status: step?.status,
          nodeKind: "external" as const,
        },
      };
    });

    const constNodes: WorkflowNodeType[] = constArr.map((id, i) => ({
      id: `const-${id}`,
      type: "workflowConstant",
      position: { x: 0, y: 40 + (extArr.length + i) * ROW_HEIGHT },
      data: {
        label: id.slice(0, 8) + "…",
        templateId: id,
        outputs: portsByTemplate[id]?.outputs || [],
        inputs: [],
        nodeKind: "constant" as const,
      },
    }));

    const hasLeftNodes = extArr.length > 0 || constArr.length > 0;
    const xOffset = hasLeftNodes ? COL_WIDTH : 0;

    // Group templates by position (level) for column layout
    const byPosition = new Map<
      number,
      { template: TemplateShort; step?: WorkflowStepResponse }[]
    >();
    for (const t of templates) {
      const step = stepByTemplate.get(t.id);
      const pos = step?.position ?? 0;
      if (!byPosition.has(pos)) byPosition.set(pos, []);
      byPosition.get(pos)!.push({ template: t, step });
    }

    // Sort position keys so columns go left-to-right
    const sortedPositions = [...byPosition.keys()].sort((a, b) => a - b);

    const tplNodes: WorkflowNodeType[] = [];
    for (let col = 0; col < sortedPositions.length; col++) {
      const posGroup = byPosition.get(sortedPositions[col])!;
      // Center the group vertically
      const groupHeight = posGroup.length * ROW_HEIGHT;
      const yStart = 40 + (posGroup.length > 1 ? 0 : 0);
      const yGroupOffset =
        posGroup.length > 1 ? -(groupHeight / 2 - ROW_HEIGHT / 2) : 0;

      for (let row = 0; row < posGroup.length; row++) {
        const { template: t, step } = posGroup[row];
        tplNodes.push({
          id: t.id,
          type: "workflowTemplate",
          position: {
            x: xOffset + col * COL_WIDTH,
            y: yStart + yGroupOffset + row * ROW_HEIGHT,
          },
          data: {
            label: t.name,
            templateId: t.id,
            outputs: portsByTemplate[t.id]?.outputs || [],
            inputs: portsByTemplate[t.id]?.inputs || [],
            status: step?.status,
            errorMessage: step?.error_message,
            resourceId: step?.resource_id,
            resourceName: step?.resource_id
              ? resources?.get(step.resource_id)?.name
              : undefined,
            position: step?.position,
            nodeKind: "template" as const,
          },
        });
      }
    }

    return [...extNodes, ...constNodes, ...tplNodes];
  }, [
    templates,
    externalIds,
    constantIds,
    portsByTemplate,
    stepByTemplate,
    resources,
  ]);

  // Draggable node state — syncs when computed nodes change (e.g. status update)
  const [draggableNodes, setDraggableNodes, onNodesChange] =
    useNodesState<WorkflowNodeType>([]);
  useEffect(() => {
    setDraggableNodes(nodes);
  }, [nodes, setDraggableNodes]);

  // Build edges
  const edges: Edge[] = useMemo(
    () =>
      wiring.map((w, i) => {
        const isConstant = constantIds.has(w.source_template_id);
        const isExternal = !isConstant && externalIds.has(w.source_template_id);
        const sourceNodeId = isConstant
          ? `const-${w.source_template_id}`
          : isExternal
            ? `ext-${w.source_template_id}`
            : w.source_template_id;

        const isInputWire = !isConstant && w.source_output.startsWith("input:");
        const displaySourceName = isInputWire
          ? w.source_output.slice(6)
          : w.source_output;
        const sourceHandle = isConstant
          ? `output-${w.source_output}`
          : isInputWire
            ? `input-source-${displaySourceName}`
            : `output-${w.source_output}`;

        // Color the edge based on source step status
        const sourceStep = isConstant
          ? undefined
          : stepByTemplate.get(w.source_template_id);
        const edgeColor =
          sourceStep?.status === "done"
            ? theme.palette.success.main
            : sourceStep?.status === "error"
              ? theme.palette.error.main
              : sourceStep?.status === "in_progress"
                ? theme.palette.info.main
                : isConstant
                  ? theme.palette.secondary.main
                  : theme.palette.grey[500];

        return {
          id: `wire-${i}`,
          source: sourceNodeId,
          sourceHandle,
          target: w.target_template_id,
          targetHandle: `input-${w.target_variable}`,
          animated:
            sourceStep?.status === "in_progress" ||
            sourceStep?.status === "done",
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
            ...(isInputWire ? { strokeDasharray: "6 3" } : {}),
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
          label: `${displaySourceName} → ${w.target_variable}`,
          labelStyle: { fontSize: 11, fill: theme.palette.text.secondary },
        };
      }),
    [wiring, theme, externalIds, constantIds, stepByTemplate],
  );

  const canvas = (
    <Box
      sx={{
        width: "100%",
        height: fullscreen ? "100%" : height,
        position: "relative",
        border: fullscreen ? "none" : `1px solid ${theme.palette.divider}`,
        borderRadius: fullscreen ? 0 : 2,
        overflow: "hidden",
      }}
    >
      <ReactFlow
        nodes={draggableNodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        colorMode={mode === "dark" ? "dark" : "light"}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Fullscreen toggle */}
      <IconButton
        size="small"
        onClick={() => setFullscreen((v) => !v)}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          bgcolor: "background.paper",
          border: `1px solid ${theme.palette.divider}`,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {fullscreen ? (
          <CloseFullscreenIcon fontSize="small" />
        ) : (
          <FullscreenIcon fontSize="small" />
        )}
      </IconButton>
    </Box>
  );

  if (fullscreen) {
    return (
      <Dialog
        open
        fullScreen
        onClose={() => setFullscreen(false)}
        PaperProps={{ sx: { bgcolor: "background.default" } }}
      >
        <DialogContent sx={{ p: 0, height: "100vh" }}>{canvas}</DialogContent>
      </Dialog>
    );
  }

  return canvas;
};
