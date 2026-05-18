import { useState } from "react";

import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ListIcon from "@mui/icons-material/List";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";

import { useLocalStorage } from "../../common";
import { Audit } from "../../common/components/activity/Audit";
import { EntityLogs } from "../../common/components/activity/EntityLogs";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { PropertyCard } from "../../common/components/PropertyCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { WorkflowResponse } from "../types";

import { WorkflowOverview } from "./WorkflowOverview";
import { WorkflowResolvedVariables } from "./WorkflowResolvedVariables";
import { WorkflowSteps } from "./WorkflowSteps";
import { WorkflowWiringViewer } from "./WorkflowWiringViewer";

const WorkflowStepsTab = ({ workflow }: { workflow: WorkflowResponse }) => {
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

  const hasWiring = workflow.wiring_snapshot.length > 0;

  return (
    <PropertyCard
      title="Workflow Steps"
      action={
        hasWiring && (
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v) => v && setViewAndPersist(v)}
            size="small"
          >
            <ToggleButton value="list">
              <ListIcon fontSize="small" sx={{ mr: 0.5 }} />
              List
            </ToggleButton>
            <ToggleButton value="diagram">
              <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Diagram
            </ToggleButton>
          </ToggleButtonGroup>
        )
      }
    >
      {view === "list" ? (
        <WorkflowSteps steps={workflow.steps} />
      ) : hasWiring ? (
        <WorkflowWiringViewer
          wiring={workflow.wiring_snapshot}
          steps={workflow.steps}
        />
      ) : (
        <WorkflowSteps steps={workflow.steps} />
      )}
    </PropertyCard>
  );
};

export const WorkflowContent = () => {
  const { entity } = useEntityProvider();

  const workflow = entity as WorkflowResponse | undefined;

  if (!workflow) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Steps",
      content: <WorkflowStepsTab workflow={workflow} />,
    },
    {
      label: "Variables",
      content: (
        <PropertyCard title="Resolved Variables">
          <WorkflowResolvedVariables steps={workflow.steps} />
        </PropertyCard>
      ),
    },
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
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <WorkflowOverview />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
