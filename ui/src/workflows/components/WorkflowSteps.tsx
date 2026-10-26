import { GqlWorkflowAction, GqlWorkflowStep } from "../graphql";

import { WorkflowStep } from "./WorkflowStep";

interface WorkflowStepsProps {
  steps: GqlWorkflowStep[];
  workflowAction?: GqlWorkflowAction;
  workflowId?: string;
}

export const WorkflowSteps = ({
  steps,
  workflowAction,
  workflowId,
}: WorkflowStepsProps) => {
  if (steps.length === 0) {
    return (
      <p className="m-0 py-4 text-body2 text-fg-muted">No workflow steps.</p>
    );
  }

  const sorted = [...steps].sort((a, b) => a.position - b.position);

  return (
    <div className="w-full">
      {sorted.map((step) => {
        return (
          <WorkflowStep
            step={step}
            key={step.id}
            workflowAction={workflowAction}
            workflowId={workflowId}
          />
        );
      })}
    </div>
  );
};
