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
import { alpha } from "@mui/material/styles";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { CODE_FONT_FAMILY } from "../../../theme";
import { STATUS_CHIP_COLOR } from "../../../utils";
import { InlineCode } from "../../code/InlineCode";
import { GetReferenceUrlValue } from "../../fields/CommonField";

import { DiagramNode, makeHandleStyle, useCanvasPalette } from "./helpers";

export function TemplateNode({ data }: NodeProps<DiagramNode>) {
  const theme = useTheme();
  const palette = useCanvasPalette();
  const bg = palette.background.paper;
  const isExternal = data.kind === "external";
  const displayOrder =
    data.order ??
    (data.stepPosition != null ? data.stepPosition + 1 : undefined);
  const canRemove = typeof data.onRemove === "function";

  // External nodes always use warning palette; template nodes use the
  // theme's `info` blue unless a workflow status overrides it.
  const accent = palette.info.main;
  let headerBg = isExternal ? palette.warning.main : accent;
  let headerText = isExternal ? palette.warning.contrastText : "#ffffff";
  let borderStyle = isExternal ? "dashed" : "solid";
  let borderColor = isExternal ? palette.warning.main : accent;

  if (!isExternal && data.status && data.status !== "pending") {
    const p =
      data.status === "done"
        ? palette.success
        : data.status === "error"
          ? palette.error
          : data.status === "in_progress"
            ? palette.info
            : palette.warning;
    headerBg = p.main;
    headerText = p.contrastText;
    borderColor = p.main;
  }

  return (
    <Box
      sx={{
        background: bg,
        border: `1px ${borderStyle} ${borderColor}`,
        borderRadius: "var(--template-surface-radius)",
        minWidth: 220,
        maxWidth: 300,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 0.5,
          borderBottom: `1px solid ${palette.divider}`,
          background: `color-mix(in srgb, ${headerBg} 85%, transparent)`,
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
          // Not a Chip: the theme's dark-mode Chip background out-specifies
          // `sx` and would force a grey badge onto the coloured header.
          <Box
            sx={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 20,
              height: 20,
              px: 0.5,
              borderRadius: "10px",
              bgcolor: "rgba(255, 255, 255, 0.25)",
              color: headerText,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {displayOrder}
          </Box>
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
            color={STATUS_CHIP_COLOR[data.status]}
            sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
          />
        )}
        {canRemove && (
          <Tooltip title="Remove" arrow>
            <IconButton
              size="small"
              onClick={() => data.onRemove?.(data.templateId)}
              sx={{
                color: headerText,
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
      {/* External badge */}
      {isExternal && (
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Chip label="External" variant="outlined" color="warning" />
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "block",
              mt: 0.5,
              mb: 0.5,
            }}
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
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
            }}
          >
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
              borderRadius: "var(--template-surface-radius)",
              fontSize: 11,
              fontFamily: CODE_FONT_FAMILY,
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
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                display: "block",
                mb: 0.5,
              }}
            >
              Inputs
            </Typography>
            {data.inputs.map((input) => (
              <Box
                key={`in-${input}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  my: 0.4,
                  minWidth: 0,
                }}
              >
                <Tooltip
                  title={
                    <>
                      Drag from an output to connect it to{" "}
                      <InlineCode disableCopy sx={{ mx: 0.25 }}>
                        {input}
                      </InlineCode>
                    </>
                  }
                  arrow
                  placement="left"
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`input-${input}`}
                    style={{
                      ...makeHandleStyle(palette.info.main, bg),
                      marginRight: 4,
                    }}
                  />
                </Tooltip>
                <Tooltip title={input} arrow>
                  <Chip
                    label={input}
                    variant="outlined"
                    color="info"
                    sx={{
                      fontSize: 11,
                      minWidth: 0,
                      flex: "0 1 auto",
                      "& .MuiChip-label": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  />
                </Tooltip>
                <Tooltip
                  title={
                    <>
                      Drag to use{" "}
                      <InlineCode disableCopy sx={{ mx: 0.25 }}>
                        {input}
                      </InlineCode>{" "}
                      as a source for another input
                    </>
                  }
                  arrow
                  placement="right"
                >
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`input-source-${input}`}
                    style={{
                      ...makeHandleStyle(palette.info.light, bg, 7),
                      marginLeft: 4,
                    }}
                  />
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}

        {data.outputs.length > 0 && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
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
                  minWidth: 0,
                }}
              >
                <Tooltip title={output} arrow>
                  <Chip
                    label={output}
                    variant="outlined"
                    color="success"
                    sx={{
                      fontSize: 11,
                      minWidth: 0,
                      flex: "0 1 auto",
                      "& .MuiChip-label": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  />
                </Tooltip>
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
                      ...makeHandleStyle(palette.success.main, bg),
                      marginLeft: 4,
                    }}
                  />
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      {/* Required configuration variables: set from a wire and usable as a source */}
      {(data.configs?.length ?? 0) > 0 && (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 600,
              display: "block",
              mb: 0.5,
            }}
          >
            Dependency config
          </Typography>
          {data.configs?.map((config) => (
            <Box
              key={`config-${config}`}
              sx={{
                display: "flex",
                alignItems: "center",
                my: 0.4,
                minWidth: 0,
              }}
            >
              {/* External resources already exist, their config is only a source */}
              {!isExternal && (
                <Tooltip
                  title={
                    <>
                      Drag from an output or constant to set{" "}
                      <InlineCode disableCopy sx={{ mx: 0.25 }}>
                        {config}
                      </InlineCode>
                    </>
                  }
                  arrow
                  placement="left"
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`config-in-${config}`}
                    style={{
                      ...makeHandleStyle(palette.secondary.main, bg),
                      marginRight: 4,
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title={config} arrow>
                <Chip
                  label={config}
                  variant="outlined"
                  color="secondary"
                  sx={{
                    fontSize: 11,
                    minWidth: 0,
                    flex: "0 1 auto",
                    mr: "auto",
                    "& .MuiChip-label": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
              </Tooltip>
              <Tooltip
                title={
                  <>
                    Drag to connect{" "}
                    <InlineCode disableCopy sx={{ mx: 0.25 }}>
                      {config}
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
                  id={`config-out-${config}`}
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
    </Box>
  );
}
