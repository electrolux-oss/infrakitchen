import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { StorageResponse } from "../types";

import { StorageConfiguration } from "./StorageConfiguration";
import { StorageOverview } from "./StorageOverview";
import { StorageResources } from "./StorageResources";

export interface StorageContentProps {
  storage: StorageResponse;
}

export const StorageContent = () => {
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
      <StorageOverview storage={entity} />
      <StorageConfiguration storage={entity} />
      <StorageResources storage_id={entity.id} />
      <DangerZoneCard />
    </Box>
  );
};
