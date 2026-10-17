import { useMemo } from "react";

import {
  GenericStep,
  WiringRule,
} from "../../common/components/viewers/Wiring/types";
import { WiringDiagram } from "../../common/components/viewers/Wiring/WiringDiagram";
import { GqlTemplateShort } from "../../templates/graphql";
import { GqlWorkflowStep } from "../graphql";

export interface WorkflowWiringViewerProps {
  wiring: WiringRule[];
  steps: GqlWorkflowStep[];
  height?: number;
}

/**
 * The shared WiringDiagram consumes the snake_case GenericStep shape. Map the
 * camelCase workflow steps to that shape at this boundary so the shared viewer
 * (also used by blueprints) stays unchanged.
 */
function toGenericStep(step: GqlWorkflowStep): GenericStep {
  return {
    id: step.id,
    template_id: step.template?.id,
    template: step.template,
    resource_id: step.resource?.id,
    resource: step.resource,
    position: step.position,
    status: step.status,
    error_message: step.errorMessage,
    resolved_variables: step.resolvedVariables,
    started_at: step.startedAt,
    completed_at: step.completedAt,
  };
}

export const WorkflowWiringViewer = ({
  wiring,
  steps,
  height = 500,
}: WorkflowWiringViewerProps) => {
  const genericSteps = useMemo(() => steps.map(toGenericStep), [steps]);

  const templates = useMemo(
    () =>
      steps
        .map((s) => s.template)
        .filter((t): t is GqlTemplateShort => t !== null),
    [steps],
  );

  const externalTemplates = useMemo(() => {
    const byTemplateId = new Map<
      string,
      {
        id: string;
        name: string;
        resource: NonNullable<GqlWorkflowStep["parentResourceIds"]>[number];
      }
    >();

    for (const resource of steps.flatMap((s) => s.parentResourceIds ?? [])) {
      const template = resource.template!;
      if (!byTemplateId.has(template.id)) {
        byTemplateId.set(template.id, {
          id: template.id,
          name: template.name,
          resource,
        });
      }
    }

    return [...byTemplateId.values()];
  }, [steps]);

  return (
    <WiringDiagram
      templates={templates}
      externalTemplates={externalTemplates}
      wiring={wiring}
      steps={genericSteps}
      height={height}
      allowFullscreen
    />
  );
};
