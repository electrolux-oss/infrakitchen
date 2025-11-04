import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { IntegrationConfiguration } from "./IntegrationConfiguration";
import { IntegrationOverview } from "./IntegrationOverview";
import { IntegrationResources } from "./IntegrationResources";
import { IntegrationSourceCodeDependencies } from "./IntegrationSourceCodeDependencies";
import { IntegrationWorkspaceDependencies } from "./IntegrationWorkspaceDependencies";

export const IntegrationContent = () => {
  const { entity } = useEntityProvider();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <IntegrationOverview integration={entity} />
      <IntegrationConfiguration integration={entity} />
      {entity.integration_type === "git" && (
        <IntegrationSourceCodeDependencies integration_id={entity.id} />
      )}
      {entity.integration_type === "git" && (
        <IntegrationWorkspaceDependencies integration_id={entity.id} />
      )}
      {entity.integration_type === "cloud" && (
        <IntegrationResources integration_id={entity.id} />
      )}
      <DangerZoneCard />
    </Box>
  );
};
