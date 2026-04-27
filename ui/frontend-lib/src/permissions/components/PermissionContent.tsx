import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { PermissionOverview } from "./PermissionOverview";

export const PermissionContent = () => {
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
      <PermissionOverview permission={entity} />
      <DangerZoneCard />
    </Box>
  );
};
