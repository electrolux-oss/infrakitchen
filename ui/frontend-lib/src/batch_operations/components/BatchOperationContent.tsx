import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { BatchOperationEntities } from "./BatchOperationEntities";
import { BatchOperationErrorEntities } from "./BatchOperationErrorEntities";
import { BatchOperationOverview } from "./BatchOperationOverview";

export const BatchOperationContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

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
      <BatchOperationOverview batchOperation={entity} />
      <BatchOperationErrorEntities batchOperation={entity} />
      <BatchOperationEntities batchOperation={entity} />
      <DangerZoneCard />
    </Box>
  );
};
