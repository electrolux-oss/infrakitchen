import { useMemo } from "react";

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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, Chip, Typography, useColorScheme, useTheme } from "@mui/material";

import { TemplateShort } from "../../templates/types";
import { WiringRule } from "../types";

// ── Read-only template node ────────────────────────────────────────────────

interface ReadOnlyNodeData {
  label: string;
  templateId: string;
  outputs: string[];
  inputs: string[];
  [key: string]: unknown;
}

type ReadOnlyNodeType = Node<ReadOnlyNodeData>;

function ReadOnlyTemplateNode({ data }: NodeProps<ReadOnlyNodeType>) {
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
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 2,
        minWidth: 220,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.primary.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: theme.palette.primary.contrastText }}
        >
          {data.label}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, p: 1.5 }}>
        {/* Inputs */}
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

        {/* Outputs */}
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

// ── Read-only external template node (input) ───────────────────────────────

function ReadOnlyExternalNode({ data }: NodeProps<ReadOnlyNodeType>) {
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
        border: `2px dashed ${theme.palette.warning.main}`,
        borderRadius: 2,
        minWidth: 220,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.warning.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <StorageIcon
          fontSize="small"
          sx={{ color: theme.palette.warning.contrastText }}
        />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: theme.palette.warning.contrastText }}
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
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 1 }}
        >
          Resource selected when using blueprint
        </Typography>

        {/* Outputs */}
        {data.outputs.length > 0 && (
          <Box>
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

// ── Read-only constant node ────────────────────────────────────────────────

function ReadOnlyConstantNode({ data }: NodeProps<ReadOnlyNodeType>) {
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
      {/* Header */}
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

        {/* Output handle */}
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

const nodeTypes = {
  templateNode: ReadOnlyTemplateNode,
  externalTemplateNode: ReadOnlyExternalNode,
  constantNode: ReadOnlyConstantNode,
};

// ── Props ──────────────────────────────────────────────────────────────────

interface WiringViewerProps {
  templates: TemplateShort[];
  wiring: WiringRule[];
  /** External (input) templates — shown as amber/dashed nodes */
  externalTemplates?: Array<{ id: string; name: string }>;
  /** Constant blocks — shown as purple nodes */
  constants?: Array<{ id: string; name: string }>;
  height?: number;
}

export const WiringViewer = ({
  templates,
  wiring,
  externalTemplates = [],
  constants = [],
  height = 400,
}: WiringViewerProps) => {
  const theme = useTheme();
  const { mode } = useColorScheme();

  // Derive unique input/output names from wiring
  const portsByTemplate = useMemo(() => {
    const m: Record<string, { inputs: Set<string>; outputs: Set<string> }> = {};
    for (const t of templates) {
      m[t.id] = { inputs: new Set(), outputs: new Set() };
    }
    for (const ext of externalTemplates) {
      m[ext.id] = { inputs: new Set(), outputs: new Set() };
    }
    for (const c of constants) {
      m[c.id] = { inputs: new Set(), outputs: new Set() };
    }
    for (const w of wiring) {
      const isConstantWire = constants.some(
        (c) => c.id === w.source_template_id,
      );
      const isInputWire =
        !isConstantWire && w.source_output.startsWith("input:");
      if (isConstantWire) {
        const constant = constants.find((c) => c.id === w.source_template_id);
        m[w.source_template_id]?.outputs.add(constant?.name || "value");
      } else if (isInputWire) {
        const inputName = w.source_output.slice(6);
        m[w.source_template_id]?.inputs.add(inputName);
      } else {
        m[w.source_template_id]?.outputs.add(w.source_output);
      }
      m[w.target_template_id]?.inputs.add(w.target_variable);
    }
    const result: Record<string, { inputs: string[]; outputs: string[] }> = {};
    for (const [id, sets] of Object.entries(m)) {
      result[id] = {
        inputs: [...sets.inputs],
        outputs: [...sets.outputs],
      };
    }
    return result;
  }, [templates, externalTemplates, constants, wiring]);

  const nodes: ReadOnlyNodeType[] = useMemo(() => {
    // External template nodes on the left
    const extNodes: ReadOnlyNodeType[] = externalTemplates.map((ext, i) => ({
      id: `ext-${ext.id}`,
      type: "externalTemplateNode",
      position: { x: 0, y: 40 + i * 250 },
      data: {
        label: ext.name,
        templateId: ext.id,
        outputs: portsByTemplate[ext.id]?.outputs || [],
        inputs: [],
      },
    }));

    // Constant nodes below external nodes
    const constNodes: ReadOnlyNodeType[] = constants.map((c, i) => ({
      id: `const-${c.id}`,
      type: "constantNode",
      position: { x: 0, y: 40 + (externalTemplates.length + i) * 250 },
      data: {
        label: c.name || "Constant",
        templateId: c.id,
        outputs: portsByTemplate[c.id]?.outputs || [],
        inputs: [],
      },
    }));

    // Regular template nodes offset to the right
    const hasLeftNodes = externalTemplates.length > 0 || constants.length > 0;
    const xOffset = hasLeftNodes ? 320 : 0;
    const templateNodes: ReadOnlyNodeType[] = templates.map((t, i) => ({
      id: t.id,
      type: "templateNode",
      position: { x: xOffset + i * 320, y: 40 },
      data: {
        label: t.name,
        templateId: t.id,
        outputs: portsByTemplate[t.id]?.outputs || [],
        inputs: portsByTemplate[t.id]?.inputs || [],
      },
    }));

    return [...extNodes, ...constNodes, ...templateNodes];
  }, [templates, externalTemplates, constants, portsByTemplate]);

  const edges: Edge[] = useMemo(
    () =>
      wiring.map((w, i) => {
        // Determine source node ID and wire type
        const constant = constants.find((c) => c.id === w.source_template_id);
        const isConstantWire = !!constant;
        const isExternalWire =
          !isConstantWire &&
          externalTemplates.some((ext) => ext.id === w.source_template_id);
        const sourceNodeId = isConstantWire
          ? `const-${w.source_template_id}`
          : isExternalWire
            ? `ext-${w.source_template_id}`
            : w.source_template_id;

        const isInputWire =
          !isConstantWire && w.source_output.startsWith("input:");
        const displaySourceName = isConstantWire
          ? constant.name || "value"
          : isInputWire
            ? w.source_output.slice(6)
            : w.source_output;
        const sourceHandle = isConstantWire
          ? `output-${constant.name || "value"}`
          : isInputWire
            ? `input-source-${displaySourceName}`
            : `output-${w.source_output}`;

        const strokeColor = isConstantWire
          ? theme.palette.secondary.main
          : isInputWire
            ? theme.palette.info.main
            : theme.palette.primary.main;

        return {
          id: `wire-${i}`,
          source: sourceNodeId,
          sourceHandle,
          target: w.target_template_id,
          targetHandle: `input-${w.target_variable}`,
          animated: true,
          style: {
            stroke: strokeColor,
            strokeWidth: 2,
            ...(isInputWire ? { strokeDasharray: "6 3" } : {}),
          },
          markerEnd: { type: MarkerType.ArrowClosed },
          label: `${displaySourceName} → ${w.target_variable}`,
          labelStyle: { fontSize: 11, fill: theme.palette.text.secondary },
        };
      }),
    [wiring, theme, externalTemplates, constants],
  );

  return (
    <Box
      sx={{
        width: "100%",
        height,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        colorMode={mode === "dark" ? "dark" : "light"}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
};
