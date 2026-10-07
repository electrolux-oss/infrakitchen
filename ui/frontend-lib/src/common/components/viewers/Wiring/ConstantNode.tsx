import DeleteIcon from "@mui/icons-material/Delete";
import NumbersIcon from "@mui/icons-material/Numbers";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import {
  Box,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { InlineCode } from "../../code/InlineCode";

import { DiagramNode, makeHandleStyle, useCanvasPalette } from "./helpers";

export function ConstantNode({ data }: NodeProps<DiagramNode>) {
  const theme = useTheme();
  const palette = useCanvasPalette();
  const bg = palette.background.paper;
  const canRemove = typeof data.onRemove === "function";
  const canEdit = typeof data.onUpdate === "function" && !!data.constantId;
  const hasOutputs = Array.isArray(data.outputs) && data.outputs.length > 0;
  const valueLabel = data.name || data.label || "value";

  return (
    <Box
      sx={{
        background: bg,
        border: `1px solid ${palette.secondary.main}`,
        borderRadius: "var(--template-surface-radius)",
        minWidth: 220,
        maxWidth: 300,
        boxShadow: theme.shadows[2],
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.5,
          borderBottom: `1px solid ${palette.divider}`,
          background: `color-mix(in srgb, ${palette.secondary.main} 85%, transparent)`,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          gap: 1,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          {data.constantType === "number" ? (
            <NumbersIcon
              fontSize="small"
              sx={{ color: palette.secondary.contrastText }}
            />
          ) : (
            <TextFieldsIcon
              fontSize="small"
              sx={{ color: palette.secondary.contrastText }}
            />
          )}
          <Typography
            variant="subtitle2"
            noWrap
            sx={{
              fontWeight: 700,
              color: palette.secondary.contrastText,
              minWidth: 0,
            }}
          >
            {canEdit ? "Constant" : data.label}
          </Typography>
          <InlineCode
            disableCopy
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.18)",
              color: palette.secondary.contrastText,
              flexShrink: 0,
            }}
          >
            {data.constantType === "number" ? "number" : "string"}
          </InlineCode>
        </Box>
        {canRemove && (
          <Tooltip title="Remove" arrow>
            <IconButton
              size="small"
              onClick={() =>
                data.onRemove?.(data.constantId ?? data.templateId)
              }
              sx={{
                color: palette.secondary.contrastText,
                ml: 0.5,
                p: 0.25,
                "&:hover": {
                  backgroundColor: (theme) =>
                    alpha(theme.palette.error.main, 0.35),
                },
              }}
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        sx={{ p: 1.5, pt: 3 }}
        className={canEdit ? "nodrag nowheel" : undefined}
      >
        {canEdit && (
          <TextField
            label="Name"
            value={data.name ?? ""}
            onChange={(e) => data.onUpdate?.(data.constantId!, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            fullWidth
            sx={{ mb: 2 }}
          />
        )}

        {canEdit && (
          <TextField
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
                <Chip label={output} variant="outlined" color="secondary" />
                <Tooltip
                  title={
                    <>
                      Drag to connect{" "}
                      <InlineCode disableCopy sx={{ mx: 0.25 }}>
                        {output}
                      </InlineCode>{" "}
                      to an input
                    </>
                  }
                  arrow
                  placement="right"
                >
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`output-${output}`}
                    style={{
                      ...makeHandleStyle(palette.secondary.main, bg),
                      marginLeft: 4,
                    }}
                  />
                </Tooltip>
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
            <Chip label={valueLabel} variant="outlined" color="secondary" />
            <Tooltip
              title={
                <>
                  Drag to connect{" "}
                  <InlineCode disableCopy sx={{ mx: 0.25 }}>
                    {valueLabel}
                  </InlineCode>{" "}
                  to an input
                </>
              }
              arrow
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id="output-value"
                style={{
                  ...makeHandleStyle(palette.secondary.main, bg),
                  marginLeft: 4,
                }}
              />
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}
