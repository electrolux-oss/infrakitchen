import { useState } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { WiringDiagram } from "../../common/components/viewers/Wiring/WiringDiagram";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { EditIcon, VisibilityIcon } from "../../icons/material";
import { Button } from "../../ui";
import { GqlBlueprint } from "../graphql";

import { BlueprintSidebar } from "./BlueprintSidebar";
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
                    height="fill"
                    allowFullscreen
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
    <EntitySidebarLayout sidebar={<BlueprintSidebar blueprint={blueprint} />}>
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
