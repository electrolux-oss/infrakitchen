import { Box, Typography } from "@mui/material";

import { WorkflowStepResponse } from "../types";

import { WorkflowStep } from "./WorkflowStep";

interface WorkflowStepsProps {
  steps: WorkflowStepResponse[];
}

export const WorkflowSteps = ({ steps }: WorkflowStepsProps) => {
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
        return <WorkflowStep step={step} key={step.id} />;
      })}
    </Box>
  );
};
