import { useCallback, useEffect, useState } from "react";

import { Box } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notifyError } from "../../common/hooks/useNotification";
import {
  BlueprintExecutionResponse,
  BlueprintResponse,
  WiringRule,
} from "../types";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { BlueprintOverview } from "./BlueprintOverview";
import { WiringViewer } from "./WiringViewer";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";

export const BlueprintContent = () => {
  const { entity } = useEntityProvider();
  const { ikApi } = useConfig();

  const [executions, setExecutions] = useState<BlueprintExecutionResponse[]>(
    [],
  );

  const blueprint = entity as BlueprintResponse | undefined;

  const fetchWorkflows = useCallback(async () => {
    if (!blueprint?.id) return;
    try {
      const execs = await ikApi.getList(
        'workflows',
        {
          filter: { blueprint_id: blueprint.id },
        }
      );
      setExecutions(execs.data || []);
    } catch (e: any) {
      notifyError(e);
    }
  }, [ikApi, blueprint?.id]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

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
      <BlueprintOverview />

      {hasWiring && (
        <PropertyCard title="Wiring Diagram">
          <WiringViewer
            templates={blueprint.templates}
            wiring={[...blueprint.wiring, ...constantWires]}
            externalTemplates={externalTemplates}
            constants={constants}
          />
        </PropertyCard>
      )}

      <PropertyCard title="Executions">
        <WorkflowTimeline executions={executions} />
      </PropertyCard>
      <DangerZoneCard />
    </Box>
  );
};
