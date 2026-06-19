import DeleteIcon from "@mui/icons-material/Delete";
import StorageIcon from "@mui/icons-material/Storage";
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { STATUS_CHIP_COLOR } from "../../../utils";
import { GetReferenceUrlValue } from "../../CommonField";

import { DiagramNode, makeHandleStyle } from "./helpers";

export function TemplateNode({ data }: NodeProps<DiagramNode>) {
  const theme = useTheme();
  const bg = theme.palette.background.paper;
  const isExternal = data.kind === "external";
  const displayOrder =
    data.order ??
    (data.stepPosition != null ? data.stepPosition + 1 : undefined);
  const canRemove = typeof data.onRemove === "function";

  // External nodes always use warning palette; template nodes derive from status or fall back to primary.
  let headerBg = isExternal
    ? theme.palette.warning.main
    : theme.palette.primary.main;
  let headerText = isExternal
    ? theme.palette.warning.contrastText
    : theme.palette.primary.contrastText;
  let borderStyle = isExternal ? "dashed" : "solid";
  let borderColor = isExternal
    ? theme.palette.warning.main
    : theme.palette.divider;

  if (!isExternal && data.status && data.status !== "pending") {
    const p =
      data.status === "done"
        ? theme.palette.success
        : data.status === "error"
          ? theme.palette.error
          : data.status === "in_progress"
            ? theme.palette.info
            : theme.palette.warning;
    headerBg = p.main;
    headerText = p.contrastText;
    borderColor = p.main;
  }

  return (
    <Box
      sx={{
        background: bg,
        border: `2px ${borderStyle} ${borderColor}`,
        borderRadius: 2,
        minWidth: 220,
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
          background: headerBg,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        {isExternal && (
          <StorageIcon
            fontSize="small"
            sx={{ color: headerText, flexShrink: 0 }}
          />
        )}
        {displayOrder != null && (
          <Chip
            label={displayOrder}
            size="small"
            sx={{
              fontWeight: 700,
              minWidth: 24,
              height: 20,
              bgcolor: "rgba(255,255,255,0.25)",
              color: headerText,
              fontSize: 11,
            }}
          />
        )}
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: headerText,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.label}
        </Typography>
        {data.status && !canRemove && (
          <Chip
            label={data.status.replace("_", " ").toUpperCase()}
            size="small"
            color={STATUS_CHIP_COLOR[data.status]}
            sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
          />
        )}
        {canRemove && (
          <Tooltip title="Remove" arrow>
            <IconButton
              size="small"
              onClick={() => data.onRemove?.(data.templateId)}
              sx={{ color: headerText, ml: 0.5 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* External badge */}
      {isExternal && (
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Chip
            label="External"
            size="small"
            variant="outlined"
            color="warning"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5, mb: 0.5 }}
          >
            Parent resource as input
          </Typography>
        </Box>
      )}

      {/* Resource link (workflow mode only) */}
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
            entityName="resource"
            identifier={data.resourceName ?? `${data.resourceId.slice(0, 8)}…`}
          />
        </Box>
      )}

      {/* Error message (workflow mode only) */}
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
                    ...makeHandleStyle(theme.palette.info.main, bg),
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
                    ...makeHandleStyle(theme.palette.info.light, bg, 7),
                    marginLeft: 4,
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
                    ...makeHandleStyle(theme.palette.success.main, bg),
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
