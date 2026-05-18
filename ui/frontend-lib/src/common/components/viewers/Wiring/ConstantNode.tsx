import DeleteIcon from "@mui/icons-material/Delete";
import NumbersIcon from "@mui/icons-material/Numbers";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { DiagramNode, makeHandleStyle } from "./helpers";

export function ConstantNode({ data }: NodeProps<DiagramNode>) {
  const theme = useTheme();
  const bg = theme.palette.background.paper;
  const canRemove = typeof data.onRemove === "function";
  const canEdit = typeof data.onUpdate === "function" && !!data.constantId;
  const hasOutputs = Array.isArray(data.outputs) && data.outputs.length > 0;
  const valueLabel = data.name || data.label || "value";

  return (
    <Box
      sx={{
        background: bg,
        border: `2px solid ${theme.palette.secondary.main}`,
        borderRadius: 2,
        minWidth: 220,
        boxShadow: theme.shadows[2],
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.secondary.main,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          gap: 1,
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
            {canEdit ? "Constant" : data.label}
          </Typography>
        </Box>
        {canRemove && (
          <Tooltip title="Remove" arrow>
            <IconButton
              size="small"
              onClick={() =>
                data.onRemove?.(data.constantId ?? data.templateId)
              }
              sx={{ color: theme.palette.secondary.contrastText, ml: 0.5 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ p: 1.5 }} className={canEdit ? "nodrag nowheel" : undefined}>
        <Chip
          icon={
            data.constantType === "number" ? (
              <NumbersIcon />
            ) : (
              <TextFieldsIcon />
            )
          }
          label={data.constantType === "number" ? "Number" : "String"}
          size="small"
          variant="outlined"
          color="secondary"
          sx={{ mb: 0.5 }}
        />

        {canEdit && (
          <TextField
            size="small"
            label="Name"
            value={data.name ?? ""}
            onChange={(e) => data.onUpdate?.(data.constantId!, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            fullWidth
            sx={{ mb: 1 }}
          />
        )}

        {canEdit && (
          <TextField
            size="small"
            label="Default Value"
            type={data.constantType === "number" ? "number" : "text"}
            value={data.defaultValue ?? ""}
            onChange={(e) =>
              data.onDefaultValueUpdate?.(data.constantId!, e.target.value)
            }
            onKeyDown={(e) => e.stopPropagation()}
            fullWidth
            sx={{ mb: 1 }}
          />
        )}

        {hasOutputs && (
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
                    ...makeHandleStyle(theme.palette.secondary.main, bg),
                    marginLeft: 4,
                  }}
                />
              </Box>
            ))}
          </Box>
        )}

        {!hasOutputs && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              mt: 0.5,
            }}
          >
            <Chip
              label={valueLabel}
              size="small"
              variant="outlined"
              color="secondary"
            />
            <Handle
              type="source"
              position={Position.Right}
              id="output-value"
              style={{
                ...makeHandleStyle(theme.palette.secondary.main, bg),
                marginLeft: 4,
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
