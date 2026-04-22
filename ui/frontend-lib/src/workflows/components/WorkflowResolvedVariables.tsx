import { useMemo } from "react";

import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import { notify } from "../../common/hooks/useNotification";
import { WorkflowStepResponse } from "../types";

interface WorkflowResolvedVariablesProps {
  steps: WorkflowStepResponse[];
}

/**
 * Group-by-template view of each step's resolved variables.
 * When multiple steps share the same template they are rendered as separate
 * sub-sections under that template with a position indicator so values stay
 * unambiguous.
 */
export const WorkflowResolvedVariables = ({
  steps,
}: WorkflowResolvedVariablesProps) => {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        templateName: string;
        templateId: string;
        steps: WorkflowStepResponse[];
      }
    >();
    for (const step of steps) {
      const key = step.template?.id ?? step.template_id;
      if (!map.has(key)) {
        map.set(key, {
          templateId: key,
          templateName:
            step.template?.name ?? `Template ${step.template_id.slice(0, 8)}`,
          steps: [],
        });
      }
      map.get(key)!.steps.push(step);
    }
    return [...map.values()].map((g) => ({
      ...g,
      steps: g.steps.sort((a, b) => a.position - b.position),
    }));
  }, [steps]);

  if (grouped.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No workflow steps.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {grouped.map((group) => (
        <Accordion
          key={group.templateId}
          defaultExpanded
          elevation={0}
          disableGutters
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ bgcolor: "background.default" }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                width: "100%",
              }}
            >
              <CodeIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {group.templateName}
              </Typography>
              <Chip
                label={`${group.steps.length} step${
                  group.steps.length === 1 ? "" : "s"
                }`}
                size="small"
                variant="outlined"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {group.steps.map((step) => (
              <StepVariablesBlock
                key={step.id}
                step={step}
                showPosition={group.steps.length > 1}
              />
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

interface StepVariablesBlockProps {
  step: WorkflowStepResponse;
  showPosition: boolean;
}

const StepVariablesBlock = ({
  step,
  showPosition,
}: StepVariablesBlockProps) => {
  const entries = Object.entries(step.resolved_variables ?? {});
  const jsonText = JSON.stringify(step.resolved_variables ?? {}, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      notify("Copied to clipboard", "success");
    } catch {
      notify("Failed to copy", "error");
    }
  };

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "action.hover",
        }}
      >
        {showPosition && (
          <Chip
            label={`#${step.position + 1}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, minWidth: 36 }}
          />
        )}
        <Typography variant="caption" color="text.secondary">
          {entries.length} variable{entries.length === 1 ? "" : "s"}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {entries.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, py: 1.5 }}
        >
          No resolved variables.
        </Typography>
      ) : (
        <Box
          component="pre"
          sx={{
            m: 0,
            px: 2,
            py: 1.5,
            bgcolor: "background.default",
            fontSize: 13,
            fontFamily: "monospace",
            overflow: "auto",
            maxHeight: 400,
            whiteSpace: "pre",
          }}
        >
          {jsonText}
        </Box>
      )}
    </Box>
  );
};
