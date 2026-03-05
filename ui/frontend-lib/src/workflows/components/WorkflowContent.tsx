import { useCallback, useEffect, useState } from "react";

import { Box } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { WiringViewer } from "../../blueprints/components/WiringViewer";
import { BlueprintResponse } from "../../blueprints/types";
import { WorkflowResponse } from "../types";
import { WorkflowOverview } from "./WorkflowOverview";
import { WorkflowSteps } from "./WorkflowSteps";

export const WorkflowContent = () => {
  const { entity } = useEntityProvider();
  const { ikApi } = useConfig();

  const [blueprint, setBlueprint] = useState<BlueprintResponse | null>(null);

  const workflow = entity as WorkflowResponse | undefined;

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

      {/* ── Steps ────────────────────────────────────────────────── */}
      <PropertyCard title="Workflow Steps">
        <WorkflowSteps steps={workflow.steps} blueprint={blueprint} />
      </PropertyCard>

      {/* ── Wiring Snapshot ──────────────────────────────────────── */}
      {hasWiring && blueprint && (
        <PropertyCard title="Wiring Snapshot">
          <WiringViewer
            templates={blueprint.templates}
            wiring={workflow.wiring_snapshot}
          />
        </PropertyCard>
      )}

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
