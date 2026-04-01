import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { PropertyCard } from "../../common/components/PropertyCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { BlueprintResponse, WiringRule } from "../types";

import { BlueprintOverview } from "./BlueprintOverview";
import { WiringViewer } from "./WiringViewer";
import { WorkflowTimeline } from "./WorkflowTimeline";

export const BlueprintContent = () => {
  const { entity } = useEntityProvider();

  const blueprint = entity as BlueprintResponse | undefined;

  if (!blueprint) return null;

  const externalTemplates =
    (blueprint.configuration?.external_templates as Array<{
      id: string;
      name: string;
    }>) || [];

  const constants =
    (blueprint.configuration?.constants as Array<{
      id: string;
      name: string;
    }>) || [];

  const constantWires =
    (blueprint.configuration?.constant_wires as WiringRule[]) || [];

  const hasWiring =
    blueprint.wiring.length > 0 ||
    externalTemplates.length > 0 ||
    constants.length > 0;

  const tabs: TabDefinition[] = [
    ...(hasWiring
      ? [
          {
            label: "Wiring",
            content: (
              <PropertyCard title="Wiring Diagram">
                <WiringViewer
                  templates={blueprint.templates}
                  wiring={[...blueprint.wiring, ...constantWires]}
                  externalTemplates={externalTemplates}
                  constants={constants}
                />
              </PropertyCard>
            ),
          },
        ]
      : []),
    {
      label: "Executions",
      content: (
        <PropertyCard title="Executions">
          <WorkflowTimeline executions={blueprint.workflows} />
        </PropertyCard>
      ),
    },
    {
      label: "Audit",
      content: (
        <Audit
          entityId={blueprint.id}
          showRevisionColumn
          showTimelineView
          sourceCodeLanguage={"opentofu"}
        />
      ),
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <BlueprintOverview />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
