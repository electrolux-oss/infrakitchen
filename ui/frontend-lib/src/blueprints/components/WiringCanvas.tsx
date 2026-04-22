import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import SearchIcon from "@mui/icons-material/Search";
import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Button,
  Divider,
  Typography,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  useColorScheme,
  useTheme,
} from "@mui/material";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  NodeProps,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { TemplateShort } from "../../templates/types";
import { IkEntity } from "../../types";
import { WiringRule } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TemplatePorts {
  inputs: string[];
  outputs: string[];
}

/**
 * A template pinned onto the canvas as an external input (parent).
 * When using the blueprint the user selects an actual resource of this
 * template type.
 */
export interface ExternalTemplate {
  id: string; // template ID
  name: string; // template display name
}

/**
 * A constant block pinned onto the canvas.
 * Provides a fixed value that can be wired to template inputs.
 */
export interface ConstantBlock {
  id: string; // unique constant ID
  name: string; // display name / output label
}

interface TemplateNodeData {
  label: string;
  templateId: string;
  order: number;
  inputs: string[];
  outputs: string[];
  onRemove: (templateId: string) => void;
  [key: string]: unknown;
}

interface ExternalTemplateNodeData {
  label: string;
  templateId: string;
  outputs: string[];
  onRemove: (templateId: string) => void;
  [key: string]: unknown;
}

interface ConstantNodeData {
  label: string;
  constantId: string;
  name: string;
  onRemove: (constantId: string) => void;
  onUpdate: (constantId: string, name: string) => void;
  [key: string]: unknown;
}

type TemplateNodeType = Node<TemplateNodeData>;
type ExternalTemplateNodeType = Node<ExternalTemplateNodeData>;
type ConstantNodeType = Node<ConstantNodeData>;

// ── Custom Node ────────────────────────────────────────────────────────────

function TemplateNode({ data }: NodeProps<TemplateNodeType>) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 2,
        minWidth: 220,
        maxWidth: 300,
        boxShadow: theme.shadows[3],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.primary.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <Chip
            label={data.order}
            size="small"
            sx={{
              height: 20,
              minWidth: 20,
              fontWeight: 700,
              fontSize: 11,
              bgcolor: "rgba(255,255,255,0.25)",
              color: theme.palette.primary.contrastText,
              "& .MuiChip-label": { px: 0.5 },
            }}
          />
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 700, color: theme.palette.primary.contrastText }}
          >
            {data.label}
          </Typography>
        </Box>
        <Tooltip title="Remove" arrow>
          <IconButton
            size="small"
            onClick={() => data.onRemove(data.templateId)}
            sx={{ color: theme.palette.primary.contrastText, ml: 0.5 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body: two columns — inputs left, outputs right */}
      <Box sx={{ display: "flex", gap: 2, p: 1.5 }}>
        {/* ── Inputs (left) ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, display: "block", mb: 0.5 }}
          >
            Inputs
          </Typography>
          {data.inputs.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              none
            </Typography>
          )}
          {data.inputs.map((name) => (
            <Box
              key={name}
              sx={{ display: "flex", alignItems: "center", my: 0.4 }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={`input-${name}`}
                style={{
                  position: "relative",
                  transform: "none",
                  top: "auto",
                  left: "auto",
                  width: 12,
                  height: 12,
                  minWidth: 12,
                  minHeight: 12,
                  background: theme.palette.info.main,
                  border: `2px solid ${theme.palette.background.paper}`,
                  borderRadius: "50%",
                  cursor: "crosshair",
                  flexShrink: 0,
                  marginRight: 4,
                }}
              />
              <Chip label={name} size="small" variant="outlined" color="info" />
              {/* Small source handle on right to allow input→input wiring */}
              <Handle
                type="source"
                position={Position.Right}
                id={`input-source-${name}`}
                style={{
                  position: "relative",
                  transform: "none",
                  top: "auto",
                  right: "auto",
                  width: 8,
                  height: 8,
                  minWidth: 8,
                  minHeight: 8,
                  background: theme.palette.info.light,
                  border: `1px solid ${theme.palette.info.main}`,
                  borderRadius: "50%",
                  cursor: "crosshair",
                  flexShrink: 0,
                  marginLeft: 2,
                }}
              />
            </Box>
          ))}
        </Box>

        {/* ── Outputs (right) ── */}
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
          {data.outputs.length === 0 && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", textAlign: "right" }}
            >
              none
            </Typography>
          )}
          {data.outputs.map((name) => (
            <Box
              key={name}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                my: 0.4,
              }}
            >
              <Chip
                label={name}
                size="small"
                variant="outlined"
                color="success"
              />
              <Handle
                type="source"
                position={Position.Right}
                id={`output-${name}`}
                style={{
                  position: "relative",
                  transform: "none",
                  top: "auto",
                  right: "auto",
                  width: 12,
                  height: 12,
                  minWidth: 12,
                  minHeight: 12,
                  background: theme.palette.success.main,
                  border: `2px solid ${theme.palette.background.paper}`,
                  borderRadius: "50%",
                  cursor: "crosshair",
                  flexShrink: 0,
                  marginLeft: 4,
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ── External Template Node (input — user selects resource when using) ───────

function ExternalTemplateNode({ data }: NodeProps<ExternalTemplateNodeType>) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        border: `2px dashed ${theme.palette.warning.main}`,
        borderRadius: 2,
        minWidth: 220,
        maxWidth: 300,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.warning.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <StorageIcon
            fontSize="small"
            sx={{ color: theme.palette.warning.contrastText }}
          />
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 700, color: theme.palette.warning.contrastText }}
          >
            {data.label}
          </Typography>
        </Box>
        <Tooltip title="Remove" arrow>
          <IconButton
            size="small"
            onClick={() => data.onRemove(data.templateId)}
            sx={{ color: theme.palette.warning.contrastText, ml: 0.5 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body */}
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

        {/* Outputs (right-side handles) */}
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
        {data.outputs.length === 0 && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", textAlign: "right" }}
          >
            none
          </Typography>
        )}
        {data.outputs.map((name) => (
          <Box
            key={name}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              my: 0.4,
            }}
          >
            <Chip
              label={name}
              size="small"
              variant="outlined"
              color="success"
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`output-${name}`}
              style={{
                position: "relative",
                transform: "none",
                top: "auto",
                right: "auto",
                width: 12,
                height: 12,
                minWidth: 12,
                minHeight: 12,
                background: theme.palette.success.main,
                border: `2px solid ${theme.palette.background.paper}`,
                borderRadius: "50%",
                cursor: "crosshair",
                flexShrink: 0,
                marginLeft: 4,
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Constant Node (fixed value wired to inputs) ─────────────────────────────

function ConstantNode({ data }: NodeProps<ConstantNodeType>) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        border: `2px solid ${theme.palette.secondary.main}`,
        borderRadius: 2,
        minWidth: 220,
        maxWidth: 300,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.secondary.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <TuneIcon
            fontSize="small"
            sx={{ color: theme.palette.secondary.contrastText }}
          />
          <Typography
            variant="subtitle2"
            noWrap
            sx={{
              fontWeight: 700,
              color: theme.palette.secondary.contrastText,
            }}
          >
            Constant
          </Typography>
        </Box>
        <Tooltip title="Remove" arrow>
          <IconButton
            size="small"
            onClick={() => data.onRemove(data.constantId)}
            sx={{ color: theme.palette.secondary.contrastText, ml: 0.5 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body */}
      <Box sx={{ p: 1.5 }} className="nodrag nowheel">
        <TextField
          size="small"
          label="Name"
          value={data.name}
          onChange={(e) => data.onUpdate(data.constantId, e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          fullWidth
          sx={{ mb: 1 }}
        />

        {/* Output handle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            mt: 0.5,
          }}
        >
          <Chip
            label={data.name || "value"}
            size="small"
            variant="outlined"
            color="secondary"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="output-value"
            style={{
              position: "relative",
              transform: "none",
              top: "auto",
              right: "auto",
              width: 12,
              height: 12,
              minWidth: 12,
              minHeight: 12,
              background: theme.palette.secondary.main,
              border: `2px solid ${theme.palette.background.paper}`,
              borderRadius: "50%",
              cursor: "crosshair",
              flexShrink: 0,
              marginLeft: 4,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

const nodeTypes = {
  templateNode: TemplateNode,
  externalTemplateNode: ExternalTemplateNode,
  constantNode: ConstantNode,
};

// ── Props ──────────────────────────────────────────────────────────────────

interface WiringCanvasProps {
  /** API client for fetching available templates */
  ikApi: InfraKitchenApi;
  /** Templates currently selected */
  selectedTemplates: TemplateShort[];
  /** Current wiring rules */
  wiring: WiringRule[];
  onWiringChange: (wiring: WiringRule[]) => void;
  /** Ports fetched from the API per template */
  templatePorts: Record<string, TemplatePorts>;
  /** Add a template to the blueprint */
  onTemplateAdd: (template: TemplateShort) => void;
  /** Remove a template from the blueprint */
  onTemplateRemove: (templateId: string) => void;
  /** Templates pinned as external inputs (parents) */
  externalTemplates: ExternalTemplate[];
  /** Add an external template */
  onExternalTemplateAdd: (template: ExternalTemplate) => void;
  /** Remove an external template */
  onExternalTemplateRemove: (templateId: string) => void;
  /** Missing parent templates that can be added as inputs */
  missingParentTemplates: ExternalTemplate[];
  /** Constant blocks pinned on the canvas */
  constants: ConstantBlock[];
  /** Add a new constant block */
  onConstantAdd: () => void;
  /** Remove a constant block */
  onConstantRemove: (constantId: string) => void;
  /** Update a constant block's name */
  onConstantUpdate: (constantId: string, name: string) => void;
}

// ── Template Sidebar ───────────────────────────────────────────────────────

const DRAG_TYPE = "application/ik-template";
const DRAG_TYPE_EXTERNAL = "application/ik-external-template";

function TemplateSidebar({
  ikApi,
  selectedIds,
  onAdd,
  missingParentTemplates,
  externalTemplateIds,
  onExternalTemplateAdd,
  onConstantAdd,
}: {
  ikApi: InfraKitchenApi;
  selectedIds: Set<string>;
  onAdd: (template: TemplateShort) => void;
  missingParentTemplates: ExternalTemplate[];
  externalTemplateIds: Set<string>;
  onExternalTemplateAdd: (template: ExternalTemplate) => void;
  onConstantAdd: () => void;
}) {
  const theme = useTheme();
  const [templates, setTemplates] = useState<IkEntity[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    ikApi
      .getList("templates", {
        pagination: { page: 1, perPage: 500 },
        sort: { field: "name", order: "ASC" },
      })
      .then((res) => setTemplates(res.data || []))
      .catch(() => {});
  }, [ikApi]);

  const filteredTemplates = templates.filter(
    (t) =>
      !selectedIds.has(t.id) &&
      !externalTemplateIds.has(t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Missing parent templates not yet added as external inputs
  const availableParentTemplates = missingParentTemplates.filter(
    (t) => !externalTemplateIds.has(t.id),
  );

  const handleDragStart = (e: React.DragEvent, template: IkEntity) => {
    e.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        id: template.id,
        name: template.name,
        _entity_name: template._entity_name,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleExternalDragStart = (
    e: React.DragEvent,
    template: ExternalTemplate,
  ) => {
    e.dataTransfer.setData(
      DRAG_TYPE_EXTERNAL,
      JSON.stringify({ id: template.id, name: template.name }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <Box
      sx={{
        width: 220,
        minWidth: 220,
        borderRight: `1px solid ${theme.palette.divider}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      {/* ── Templates section ── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          Available Templates
        </Typography>
        <TextField
          size="small"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ mt: 0.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: "text.disabled" }}
                  />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <List
        dense
        sx={{
          flex: missingParentTemplates.length > 0 ? "0 1 auto" : 1,
          overflowY: "auto",
          px: 0.5,
          py: 0,
          maxHeight: missingParentTemplates.length > 0 ? "50%" : undefined,
        }}
      >
        {filteredTemplates.length === 0 && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ px: 1.5, py: 1, display: "block" }}
          >
            {search ? "No matches" : "All templates added"}
          </Typography>
        )}
        {filteredTemplates.map((t) => (
          <ListItemButton
            key={t.id}
            draggable
            onDragStart={(e) => handleDragStart(e, t)}
            onClick={() => onAdd(t as unknown as TemplateShort)}
            sx={{
              borderRadius: 1,
              mb: 0.25,
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
              border: "1px dashed",
              borderColor: "divider",
              py: 0.5,
              bgcolor: "action.hover",
              "&:hover": { bgcolor: "action.selected" },
            }}
          >
            <ListItemText
              primary={t.name}
              slotProps={{
                primary: { variant: "body2", noWrap: true },
              }}
            />
            <Tooltip title="Add to canvas" arrow>
              <AddIcon
                fontSize="small"
                sx={{ color: "text.disabled", ml: 0.5 }}
              />
            </Tooltip>
          </ListItemButton>
        ))}
      </List>

      {/* ── Input Templates section (shown when missing parents exist) ── */}
      {missingParentTemplates.length > 0 && (
        <>
          <Divider />
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="warning.main"
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <StorageIcon sx={{ fontSize: 14 }} />
              Input Templates
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Parent templates — add to wire outputs to dependent resources.
            </Typography>
          </Box>
          <List
            dense
            sx={{
              flex: 1,
              overflowY: "auto",
              px: 0.5,
              py: 0,
            }}
          >
            {availableParentTemplates.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ px: 1.5, py: 1, display: "block" }}
              >
                All parent templates added
              </Typography>
            )}
            {availableParentTemplates.map((t) => (
              <ListItemButton
                key={t.id}
                draggable
                onDragStart={(e) => handleExternalDragStart(e, t)}
                onClick={() => onExternalTemplateAdd(t)}
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  cursor: "grab",
                  "&:active": { cursor: "grabbing" },
                  border: "1px dashed",
                  borderColor: "warning.dark",
                  py: 0.5,
                  bgcolor: "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                <ListItemText
                  primary={t.name}
                  slotProps={{
                    primary: { variant: "body2", noWrap: true },
                  }}
                />
                <Tooltip title="Add as input" arrow>
                  <AddIcon
                    fontSize="small"
                    sx={{ color: "warning.main", ml: 0.5 }}
                  />
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        </>
      )}

      {/* ── Constants section ── */}
      <Divider />
      <Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
        <Typography
          variant="caption"
          fontWeight={700}
          color="secondary.main"
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
        >
          <TuneIcon sx={{ fontSize: 14 }} />
          Constants
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Fixed values wired to inputs.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={onConstantAdd}
          fullWidth
          sx={{ mt: 1 }}
        >
          Add Constant
        </Button>
      </Box>
    </Box>
  );
}

// ── Inner Canvas (needs ReactFlowProvider ancestor) ────────────────────────

function WiringCanvasInner({
  ikApi,
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
}: WiringCanvasProps) {
  const { mode } = useColorScheme();
  const theme = useTheme();
  const reactFlowInstance = useReactFlow();
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<
    TemplateNodeType | ExternalTemplateNodeType | ConstantNodeType
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const selectedIds = useMemo(
    () => new Set(selectedTemplates.map((t) => t.id)),
    [selectedTemplates],
  );
  const externalTemplateIds = useMemo(
    () => new Set(externalTemplates.map((t) => t.id)),
    [externalTemplates],
  );

  // ── Sync nodes from props (templates + external templates + constants) ──
  useEffect(() => {
    const templateNodes: (
      | TemplateNodeType
      | ExternalTemplateNodeType
      | ConstantNodeType
    )[] = selectedTemplates.map((t, i) => {
      const pos = positionsRef.current[t.id] || { x: 260 + i * 360, y: 50 };
      const ports = templatePorts[t.id] || { inputs: [], outputs: [] };
      return {
        id: t.id,
        type: "templateNode" as const,
        position: pos,
        data: {
          label: t.name,
          templateId: t.id,
          order: i + 1,
          inputs: ports.inputs,
          outputs: ports.outputs,
          onRemove: onTemplateRemove,
        },
      };
    });

    const extNodes: (
      | TemplateNodeType
      | ExternalTemplateNodeType
      | ConstantNodeType
    )[] = externalTemplates.map((t, i) => {
      const pos = positionsRef.current[`ext-${t.id}`] || {
        x: 40,
        y: 50 + i * 250,
      };
      const ports = templatePorts[t.id] || {
        inputs: [],
        outputs: [],
      };
      return {
        id: `ext-${t.id}`,
        type: "externalTemplateNode" as const,
        position: pos,
        data: {
          label: t.name,
          templateId: t.id,
          outputs: ports.outputs,
          onRemove: (templateId: string) =>
            onExternalTemplateRemove(templateId),
        },
      };
    });

    const constNodes: (
      | TemplateNodeType
      | ExternalTemplateNodeType
      | ConstantNodeType
    )[] = constants.map((c, i) => {
      const pos = positionsRef.current[`const-${c.id}`] || {
        x: 40,
        y: 50 + (externalTemplates.length + i) * 250,
      };
      return {
        id: `const-${c.id}`,
        type: "constantNode" as const,
        position: pos,
        data: {
          label: c.name || "Constant",
          constantId: c.id,
          name: c.name,
          onRemove: onConstantRemove,
          onUpdate: onConstantUpdate,
        },
      };
    });

    setNodes([...extNodes, ...constNodes, ...templateNodes]);
  }, [
    selectedTemplates,
    templatePorts,
    onTemplateRemove,
    externalTemplates,
    onExternalTemplateRemove,
    constants,
    onConstantRemove,
    onConstantUpdate,
    setNodes,
  ]);

  // ── Sync edges from wiring ───────────────────────────────────────────
  useEffect(() => {
    setEdges(
      wiring.map((w, i) => {
        // Determine source node ID based on type
        const constant = constants.find((c) => c.id === w.source_template_id);
        const isConstantWire = !!constant;
        const isExternalWire =
          !isConstantWire &&
          externalTemplates.some((t) => t.id === w.source_template_id);
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
          ? "output-value"
          : isInputWire
            ? `input-source-${w.source_output.slice(6)}`
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
            strokeDasharray: isInputWire ? "6 3" : undefined,
          },
          markerEnd: { type: MarkerType.ArrowClosed },
          label: `${displaySourceName} → ${w.target_variable}`,
          labelStyle: { fontSize: 11, fill: theme.palette.text.secondary },
          interactionWidth: 20,
        };
      }),
    );
  }, [wiring, theme, externalTemplates, constants, setEdges]);

  // ── Preserve dragged positions ───────────────────────────────────────
  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          positionsRef.current[c.id] = c.position;
        }
      }
    },
    [onNodesChange],
  );

  // ── New connection ───────────────────────────────────────────────────
  const onConnect = useCallback(
    (conn: Connection) => {
      if (
        !conn.source ||
        !conn.target ||
        !conn.sourceHandle ||
        !conn.targetHandle
      )
        return;

      // External template nodes have id `ext-{templateId}`,
      // constant nodes have id `const-{constantId}`
      const sourceId = conn.source.startsWith("ext-")
        ? conn.source.slice(4)
        : conn.source.startsWith("const-")
          ? conn.source.slice(6)
          : conn.source;

      // Determine if this is an input→input wire or output→input wire
      let sourceOutput: string;
      if (conn.sourceHandle.startsWith("input-source-")) {
        sourceOutput = `input:${conn.sourceHandle.replace("input-source-", "")}`;
      } else {
        sourceOutput = conn.sourceHandle.replace("output-", "");
      }

      const targetVariable = conn.targetHandle.replace("input-", "");

      const exists = wiring.some(
        (w) =>
          w.source_template_id === sourceId &&
          w.source_output === sourceOutput &&
          w.target_template_id === conn.target &&
          w.target_variable === targetVariable,
      );
      if (exists) return;

      onWiringChange([
        ...wiring,
        {
          source_template_id: sourceId,
          source_output: sourceOutput,
          target_template_id: conn.target,
          target_variable: targetVariable,
        },
      ]);
    },
    [wiring, onWiringChange],
  );

  // ── Delete edges ─────────────────────────────────────────────────────
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const ids = new Set(deleted.map((e) => e.id));
      onWiringChange(wiring.filter((_w, i) => !ids.has(`wire-${i}`)));
    },
    [wiring, onWiringChange],
  );

  // ── Drop from sidebar ─────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes(DRAG_TYPE) ||
      e.dataTransfer.types.includes(DRAG_TYPE_EXTERNAL)
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      // Template drop
      const rawTemplate = e.dataTransfer.getData(DRAG_TYPE);
      if (rawTemplate) {
        e.preventDefault();
        const template = JSON.parse(rawTemplate) as TemplateShort;
        if (selectedIds.has(template.id)) return;

        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        positionsRef.current[template.id] = position;
        onTemplateAdd(template);
        return;
      }

      // External template drop
      const rawExternal = e.dataTransfer.getData(DRAG_TYPE_EXTERNAL);
      if (rawExternal) {
        e.preventDefault();
        const extTemplate = JSON.parse(rawExternal) as ExternalTemplate;
        if (externalTemplateIds.has(extTemplate.id)) return;

        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        positionsRef.current[`ext-${extTemplate.id}`] = position;
        onExternalTemplateAdd(extTemplate);
      }
    },

    [
      reactFlowInstance,
      onTemplateAdd,
      selectedIds,
      onExternalTemplateAdd,
      externalTemplateIds,
    ],
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
      {/* Sidebar */}
      <TemplateSidebar
        ikApi={ikApi}
        selectedIds={selectedIds}
        onAdd={onTemplateAdd}
        missingParentTemplates={missingParentTemplates}
        externalTemplateIds={externalTemplateIds}
        onExternalTemplateAdd={onExternalTemplateAdd}
        onConstantAdd={onConstantAdd}
      />

      {/* Flow canvas */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
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

// ── Exported wrapper (provides ReactFlowProvider) ──────────────────────────

export const WiringCanvas = (props: WiringCanvasProps) => {
  return (
    <ReactFlowProvider>
      <WiringCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
