import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { AdvancedSettings } from "./AdvancedSettings";
import { ExecutorOverview } from "./ExecutorOverview";
import { ExecutorPermissions } from "./ExecutorPermissions";

export const ExecutorContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <ExecutorOverview executor={entity} />
      <AdvancedSettings executor={entity} />
      <ExecutorPermissions executor={entity} />
      <DangerZoneCard />
    </Box>
  );
};
