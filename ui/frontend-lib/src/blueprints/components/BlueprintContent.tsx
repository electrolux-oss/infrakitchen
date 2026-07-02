import { useState } from "react";

import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Box, Button } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { PropertyCard } from "../../common/components/PropertyCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { WiringDiagram } from "../../common/components/viewers/Wiring/WiringDiagram";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { GqlBlueprint } from "../graphql";

import { BlueprintOverview } from "./BlueprintOverview";
import { BlueprintWiringEditor } from "./BlueprintWiringEditor";
import { WorkflowTimeline } from "./WorkflowTimeline";

export const BlueprintContent = () => {
  const { entity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const [wiringEdit, setWiringEdit] = useState(false);

  const blueprint = entity as GqlBlueprint | undefined;

  if (!blueprint) return null;

  const canEdit = checkActionPermission("api:blueprint", "write");

  const externalTemplates = blueprint.externalTemplates || [];

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
    ...(hasWiring || canEdit
      ? [
          {
            label: "Wiring",
            content: (
              <PropertyCard
                title="Wiring Diagram"
                action={
                  canEdit ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={wiringEdit ? <VisibilityIcon /> : <EditIcon />}
                      onClick={() => setWiringEdit((prev) => !prev)}
                    >
                      {wiringEdit ? "View" : "Edit"}
                    </Button>
                  ) : undefined
                }
              >
                {wiringEdit ? (
                  <BlueprintWiringEditor
                    blueprint={blueprint}
                    onClose={() => setWiringEdit(false)}
                  />
                ) : (
                  <WiringDiagram
                    templates={blueprint.templates}
                    wiring={[...blueprint.wiring, ...constantWires]}
                    externalTemplates={externalTemplates}
                    constants={constants}
                  />
                )}
              </PropertyCard>
            ),
          },
        ]
      : []),
    {
      label: "Workflows",
      content: (
        <PropertyCard title="Workflows">
          <WorkflowTimeline workflows={blueprint.workflows || []} />
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
