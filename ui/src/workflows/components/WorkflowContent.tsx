import { useState } from "react";

import { useLocalStorage } from "../../common";
import { Audit } from "../../common/components/activity/Audit";
import { EntityLogs } from "../../common/components/activity/EntityLogs";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { HeroRectangleGroupIcon, HeroBars3Icon } from "../../icons";
import { Tab, Tabs } from "../../ui";
import { EntityTaskQueueStatus } from "../../workers/components";
import { GqlWorkflow } from "../graphql";

import { WorkflowResolvedVariables } from "./WorkflowResolvedVariables";
import { WorkflowSidebar } from "./WorkflowSidebar";
import { WorkflowSteps } from "./WorkflowSteps";
import { WorkflowWiringViewer } from "./WorkflowWiringViewer";

const WorkflowStepsTab = ({ workflow }: { workflow: GqlWorkflow }) => {
  const storageKey = `workflow_view`;
  const { get, setKey } = useLocalStorage<Record<string, any>>();
  const savedState = get(storageKey);

  const [view, setView] = useState<"list" | "diagram">(
    savedState?.view || "list",
  );

  const setViewAndPersist = (v: "list" | "diagram") => {
    setView(v);
    setKey(storageKey, { view: v });
  };

  const hasWiring = workflow.wiringSnapshot.length > 0;

  return (
    <PropertyCard
      title="Workflow Steps"
      action={
        hasWiring && (
          <Tabs
            appearance="segmented"
            value={view}
            onChange={(_, v) => setViewAndPersist(v)}
            aria-label="Workflow steps view"
          >
            <Tab
              value="list"
              label={
                <span className="flex items-center gap-1">
                  <HeroBars3Icon fontSize="small" />
                  List
                </span>
              }
            />
            <Tab
              value="diagram"
              label={
                <span className="flex items-center gap-1">
                  <HeroRectangleGroupIcon fontSize="small" />
                  Diagram
                </span>
              }
            />
          </Tabs>
        )
      }
    >
      {view === "list" ? (
        <WorkflowSteps
          steps={workflow.steps}
          workflowAction={workflow.action}
        />
      ) : hasWiring ? (
        <WorkflowWiringViewer
          wiring={workflow.wiringSnapshot}
          steps={workflow.steps}
        />
      ) : (
        <WorkflowSteps
          steps={workflow.steps}
          workflowAction={workflow.action}
        />
      )}
    </PropertyCard>
  );
};

export const WorkflowContent = () => {
  const { entity } = useEntityProvider();

  const workflow = entity as GqlWorkflow | undefined;

  if (!workflow) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Steps",
      content: <WorkflowStepsTab workflow={workflow} />,
    },
    ...(workflow.action === "create"
      ? [
          {
            label: "Variables",
            content: (
              <PropertyCard title="Resolved Variables">
                <WorkflowResolvedVariables steps={workflow.steps} />
              </PropertyCard>
            ),
          },
        ]
      : []),
    {
      label: "Logs",
      content: (
        <EntityLogs traceId={workflow.id} sourceCodeLanguage={"opentofu"} />
      ),
    },
    {
      label: "Audit",
      content: (
        <Audit
          entityId={workflow.id}
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
    <EntitySidebarLayout sidebar={<WorkflowSidebar workflow={workflow} />}>
      <EntityTaskQueueStatus />
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
