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

import {
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { Duration } from "../../common/components/Duration";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { WorkflowStepResponse } from "../types";

interface WorkflowStepProps {
  step: WorkflowStepResponse;
  workflowAction?: "create" | "destroy";
}

export const WorkflowStep = ({ step, workflowAction }: WorkflowStepProps) => {
  const [expandedVars, setExpandedVars] = useState<string | null>(null);

  const templateName = step.template?.name;
  const hasVars = Object.keys(step.resolvedVariables).length > 0;
  const externalInputs = step.parentResourceIds;

  return (
    <Box sx={{ width: "100%" }}>
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
                id={step.templateId}
                _entity_name="template"
                name={templateName}
              />
            ) : (
              <Typography variant="subtitle2" sx={{ fontFamily: "monospace" }}>
                {step.templateId.slice(0, 8)}…
              </Typography>
            )}
            {step.template?.abstract && (
              <Chip
                label="Abstract"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            <StatusChip status={step.status} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {step.startedAt && (
              <Typography variant="caption" color="text.secondary">
                <RelativeTime date={step.startedAt} />
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
                {step.resourceId != null ? (
                  <GetReferenceUrlValue
                    id={step.resourceId}
                    _entity_name="resource"
                    identifier={
                      step.resource?.name ?? step.resourceId.slice(0, 8) + "…"
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.disabled">
                    {workflowAction === "destroy"
                      ? "Resource removed"
                      : "Not created yet"}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* SCV */}
            {step.sourceCodeVersionId && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Source Code Version
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <GetReferenceUrlValue
                    id={step.sourceCodeVersionId}
                    _entity_name="source_code_version"
                    identifier={
                      step.sourceCodeVersion?.identifier ??
                      step.sourceCodeVersionId.slice(0, 8) + "…"
                    }
                  />
                </Box>
              </Box>
            )}

            {/* Duration */}
            {step.startedAt && step.completedAt && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Duration
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Duration start={step.startedAt} end={step.completedAt} />
                </Box>
              </Box>
            )}

            {/* Parents */}
            {step.parentResourceIds.length > 0 && (
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
                  {step.parentResourceIds.map((res) => (
                    <Chip
                      key={res.id}
                      label={
                        <GetReferenceUrlValue
                          id={res.id}
                          _entity_name="resource"
                          identifier={res.name ?? res.id.slice(0, 8) + "…"}
                        />
                      }
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* External inputs from workflow wiring (read-only) */}
            {externalInputs.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600 }}
                >
                  External Inputs (Read-only)
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    mt: 0.5,
                  }}
                >
                  {externalInputs.map((resource) => (
                    <Box
                      key={`external-${resource.id}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        px: 1,
                        py: 0.75,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        bgcolor: "background.paper",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.75,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {resource.template?.name ??
                            resource.template?.id ??
                            "External"}
                        </Typography>
                        {resource.template?.abstract && (
                          <Chip
                            label="Abstract"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{
                              fontWeight: 600,
                              fontSize: "0.65rem",
                              height: 18,
                            }}
                          />
                        )}
                      </Box>
                      <GetReferenceUrlValue
                        id={resource.id}
                        _entity_name="resource"
                        identifier={
                          resource.name ?? resource.id.slice(0, 8) + "…"
                        }
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* integrations */}
            {step.integrationIds.length > 0 && (
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
                  {step.integrationIds.map((integration) => (
                    <Chip
                      key={integration.id}
                      label={
                        <GetReferenceUrlValue
                          id={integration.id}
                          _entity_name="integration"
                          name={integration.name}
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
          {step.errorMessage && (
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
              {step.errorMessage}
            </Box>
          )}
          {/* Resolved variables (collapsible) */}
          {hasVars && (
            <Accordion
              expanded={expandedVars === step.id}
              onChange={() =>
                setExpandedVars((prev) => (prev === step.id ? null : step.id))
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
                  {Object.keys(step.resolvedVariables).length})
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
                      {Object.entries(step.resolvedVariables).map(
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
    </Box>
  );
};
