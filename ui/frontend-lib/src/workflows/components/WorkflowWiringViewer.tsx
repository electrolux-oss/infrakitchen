import { useMemo } from "react";

import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { WiringDiagram } from "../../common/components/viewers/Wiring/WiringDiagram";
import { TemplateShort } from "../../templates/types";
import { WorkflowStepResponse } from "../types";

export interface WorkflowWiringViewerProps {
  wiring: WiringRule[];
  steps: WorkflowStepResponse[];
  height?: number;
}

export const WorkflowWiringViewer = ({
  wiring,
  steps,
  height = 500,
}: WorkflowWiringViewerProps) => {
  const templates = useMemo(
    () =>
      steps
        .map((s) => s.template)
        .filter((t): t is TemplateShort => t !== null),
    [steps],
  );

  const externalTemplates = useMemo(() => {
    const byTemplateId = new Map<
      string,
      {
        id: string;
        name: string;
        resource: WorkflowStepResponse["parent_resource_ids"][number];
      }
    >();

    for (const resource of steps.flatMap((s) => s.parent_resource_ids ?? [])) {
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
      steps={steps}
      height={height}
      allowFullscreen
    />
  );
};
