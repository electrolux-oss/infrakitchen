import { useMemo } from "react";

import { notify, notifyError } from "../../common/hooks/useNotification";
import { copyToClipboard } from "../../common/utils/clipboard";
import {
  CodeIcon,
  ContentCopyIcon,
  ExpandMoreIcon,
} from "../../icons/material";
import {
  IconButton,
  Chip,
  Tooltip,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "../../ui";
import { GqlWorkflowStep } from "../graphql";

interface WorkflowResolvedVariablesProps {
  steps: GqlWorkflowStep[];
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
        steps: GqlWorkflowStep[];
      }
    >();
    for (const step of steps) {
      const key = step.template?.id;
      if (!map.has(key)) {
        map.set(key, {
          templateId: key,
          templateName:
            step.template?.name ?? `Template ${step.template.id.slice(0, 8)}`,
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
      <p className="m-0 py-4 text-body2 text-fg-muted">No workflow steps.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map((group) => (
        <Accordion
          standalone
          className="overflow-hidden"
          key={group.templateId}
          defaultExpanded
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className="bg-canvas" />}
          >
            <div className="flex w-full items-center gap-3">
              <CodeIcon fontSize="small" color="action" />
              <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
                {group.templateName}
              </h6>
              <Chip
                label={`${group.steps.length} step${
                  group.steps.length === 1 ? "" : "s"
                }`}
                variant="outlined"
              />
            </div>
          </AccordionSummary>
          <AccordionDetails className="p-0">
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
    </div>
  );
};

interface StepVariablesBlockProps {
  step: GqlWorkflowStep;
  showPosition: boolean;
}

const StepVariablesBlock = ({
  step,
  showPosition,
}: StepVariablesBlockProps) => {
  const entries = Object.entries(step.resolvedVariables ?? {});
  const jsonText = JSON.stringify(step.resolvedVariables ?? {}, null, 2);

  const handleCopy = async () => {
    try {
      await copyToClipboard(jsonText);
      notify("Copied to clipboard", "success");
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <div className="border-t border-divider first-of-type:border-t-0">
      <div className="flex items-center gap-2 bg-hover px-4 py-2">
        {showPosition && (
          <Chip
            className="min-w-9 font-bold"
            label={`#${step.position + 1}`}
            color="primary"
          />
        )}
        <span className="text-caption text-fg-muted">
          {entries.length} variable{entries.length === 1 ? "" : "s"}
        </span>
        <div className="flex-1" />
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      {entries.length === 0 ? (
        <p className="m-0 px-4 py-3 text-body2 text-fg-muted">
          No resolved variables.
        </p>
      ) : (
        <pre className="m-0 max-h-100 overflow-auto rounded-code bg-canvas px-4 py-3 font-mono text-[13px] whitespace-pre">
          {jsonText}
        </pre>
      )}
    </div>
  );
};
