import { useCallback, useEffect, useState } from "react";

import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ListIcon from "@mui/icons-material/List";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";

import { BlueprintResponse } from "../../blueprints/types";
import { useLocalStorage } from "../../common";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useWorkflowMetadata } from "../hooks/useWorkflowMetadata";
import { WorkflowResponse } from "../types";

import { WorkflowOverview } from "./WorkflowOverview";
import { WorkflowSteps } from "./WorkflowSteps";
import { WorkflowWiringViewer } from "./WorkflowWiringViewer";

export const WorkflowContent = () => {
  const { entity } = useEntityProvider();
  const { ikApi } = useConfig();

  const [blueprint, setBlueprint] = useState<BlueprintResponse | null>(null);

  const storageKey = `workflow_view`;
  const { get, setKey } = useLocalStorage<Record<string, any>>();
  const savedState = get(storageKey);

  const [view, setView] = useState<"list" | "diagram">(
    savedState?.view || "list",
  );

  const workflow = entity as WorkflowResponse | undefined;

  const { resources, integrations, sourceCodeVersions } = useWorkflowMetadata(
    workflow?.steps ?? [],
  );

  const setViewAndPersist = (v: "list" | "diagram") => {
    setView(v);
    setKey(storageKey, { view: v });
  };

  const fetchBlueprint = useCallback(async () => {
    if (!workflow?.blueprint_id) return;
    try {
      const bp: BlueprintResponse = await ikApi.get(
        `blueprints/${workflow.blueprint_id}`,
      );
      setBlueprint(bp);
    } catch {
      // Blueprint may have been deleted — continue without it
    }
  }, [ikApi, workflow?.blueprint_id]);

  useEffect(() => {
    fetchBlueprint();
  }, [fetchBlueprint]);

  if (!workflow) return null;

  const hasWiring = workflow.wiring_snapshot.length > 0;

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <WorkflowOverview blueprint={blueprint} />

      {/* ── Steps / Wiring toggle ────────────────────────────────── */}
      <PropertyCard
        title="Workflow Steps"
        action={
          hasWiring &&
          blueprint && (
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
          <WorkflowSteps
            steps={workflow.steps}
            blueprint={blueprint}
            resources={resources}
            integrations={integrations}
            sourceCodeVersions={sourceCodeVersions}
          />
        ) : hasWiring && blueprint ? (
          <WorkflowWiringViewer
            templates={blueprint.templates}
            wiring={workflow.wiring_snapshot}
            steps={workflow.steps}
            resources={resources}
          />
        ) : (
          <WorkflowSteps
            steps={workflow.steps}
            blueprint={blueprint}
            resources={resources}
            integrations={integrations}
            sourceCodeVersions={sourceCodeVersions}
          />
        )}
      </PropertyCard>

      {/* ── Variable Overrides ───────────────────────────────────── */}
      {Object.keys(workflow.variable_overrides).length > 0 && (
        <PropertyCard title="Variable Overrides">
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: "background.default",
              borderRadius: 1,
              overflow: "auto",
              maxHeight: 400,
              fontSize: 13,
              fontFamily: "monospace",
            }}
          >
            {JSON.stringify(workflow.variable_overrides, null, 2)}
          </Box>
        </PropertyCard>
      )}

      <DangerZoneCard />
    </Box>
  );
};
