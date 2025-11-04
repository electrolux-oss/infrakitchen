import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { WorkspaceConfiguration } from "./WorkspaceConfiguration";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { WorkspaceResources } from "./WorkspaceResources";

export const WorkspaceContent = () => {
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
      <WorkspaceOverview workspace={entity} />
      <WorkspaceConfiguration workspace={entity} />
      <WorkspaceResources workspace_id={entity.id} />
      <DangerZoneCard />
    </Box>
  );
};
