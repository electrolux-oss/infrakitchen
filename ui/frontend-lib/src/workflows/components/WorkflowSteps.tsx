import { useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { BlueprintResponse } from "../../blueprints/types";
import {
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { EntityMeta } from "../hooks/useWorkflowMetadata";
import { WorkflowStepResponse } from "../types";

interface WorkflowStepsProps {
  steps: WorkflowStepResponse[];
  blueprint: BlueprintResponse | null;
  resources?: Map<string, EntityMeta>;
  integrations?: Map<string, EntityMeta>;
  sourceCodeVersions?: Map<string, EntityMeta>;
}

export const WorkflowSteps = ({
  steps,
  blueprint,
  resources,
  integrations,
  sourceCodeVersions,
}: WorkflowStepsProps) => {
  const [expandedVars, setExpandedVars] = useState<string | null>(null);

  const templateNameMap = new Map(
    (blueprint?.templates || []).map((t) => [t.id, t.name]),
  );

  if (steps.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No workflow steps.
      </Typography>
    );
  }

  const sorted = [...steps].sort((a, b) => a.position - b.position);

  return (
    <Box sx={{ width: "100%" }}>
      {sorted.map((step) => {
        const templateName = templateNameMap.get(step.template_id);
        const hasVars = Object.keys(step.resolved_variables).length > 0;

        return (
          <Box
            key={step.id}
            sx={{
              mb: 2,
              border: 1,
              borderColor:
                step.status === "error"
                  ? "error.main"
                  : step.status === "done"
                    ? "success.main"
                    : "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {/* Step header */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Chip
                  label={step.position + 1}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700, minWidth: 28 }}
                />
                {templateName ? (
                  <GetEntityLink
                    id={step.template_id}
                    _entity_name="template"
                    name={templateName}
                  />
                ) : (
                  <Typography
                    variant="subtitle2"
                    sx={{ fontFamily: "monospace" }}
                  >
                    {step.template_id.slice(0, 8)}…
                  </Typography>
                )}
                <StatusChip status={step.status} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {step.started_at && (
                  <Typography variant="caption" color="text.secondary">
                    <RelativeTime date={step.started_at} />
                  </Typography>
                )}
              </Box>
            </Box>

            {step.status === "in_progress" && <LinearProgress />}

            {/* Step detail fields */}
            <Box sx={{ px: 2, py: 1.5 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                {/* Resource */}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Resource
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {step.resource_id ? (
                      <GetReferenceUrlValue
                        id={step.resource_id}
                        _entity_name="resource"
                        identifier={
                          resources?.get(step.resource_id)?.name ??
                          step.resource_id.slice(0, 8) + "…"
                        }
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        Not created yet
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* SCV */}
                {step.source_code_version_id && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Source Code Version
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <GetReferenceUrlValue
                        id={step.source_code_version_id}
                        _entity_name="source_code_version"
                        identifier={
                          sourceCodeVersions?.get(step.source_code_version_id)
                            ?.name ??
                          step.source_code_version_id.slice(0, 8) + "…"
                        }
                      />
                    </Box>
                  </Box>
                )}

                {/* Duration */}
                {step.started_at && step.completed_at && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Duration
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2">
                        {formatDuration(step.started_at, step.completed_at)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Parents */}
                {step.parent_resource_ids.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600 }}
                    >
                      Parent Resources
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        flexWrap: "wrap",
                        mt: 0.5,
                      }}
                    >
                      {step.parent_resource_ids.map((id) => (
                        <Chip
                          key={id}
                          label={
                            <GetReferenceUrlValue
                              id={id}
                              _entity_name="resource"
                              identifier={
                                resources?.get(id)?.name ?? id.slice(0, 8) + "…"
                              }
                            />
                          }
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* integrations */}
                {step.integration_ids.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600 }}
                    >
                      Integrations
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        flexWrap: "wrap",
                        mt: 0.5,
                      }}
                    >
                      {step.integration_ids.map((id) => (
                        <Chip
                          key={id}
                          label={
                            <GetReferenceUrlValue
                              id={id}
                              _entity_name="integration"
                              identifier={
                                integrations?.get(id)?.name ??
                                id.slice(0, 8) + "…"
                              }
                            />
                          }
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Error message */}
              {step.error_message && (
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: "error.main",
                    color: "error.contrastText",
                    borderRadius: 1,
                    fontSize: 13,
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {step.error_message}
                </Box>
              )}
              {/* Resolved variables (collapsible) */}
              {hasVars && (
                <Accordion
                  expanded={expandedVars === step.id}
                  onChange={() =>
                    setExpandedVars((prev) =>
                      prev === step.id ? null : step.id,
                    )
                  }
                  elevation={0}
                  sx={{
                    mt: 1.5,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Resolved Variables (
                      {Object.keys(step.resolved_variables).length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Variable</TableCell>
                            <TableCell>Value</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(step.resolved_variables).map(
                            ([key, value]) => (
                              <TableRow key={key}>
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily: "monospace",
                                      fontSize: 12,
                                    }}
                                  >
                                    {key}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily: "monospace",
                                      fontSize: 12,
                                      maxWidth: 400,
                                      wordBreak: "break-all",
                                    }}
                                  >
                                    {typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSecs}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}
