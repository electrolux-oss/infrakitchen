import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { SecretResponse } from "../types";

import { SecretConfiguration } from "./SecretConfiguration";
import { SecretOverview } from "./SecretOverview";
import { SecretResources } from "./SecretResources";

export interface SecretContentProps {
  secret: SecretResponse;
}

export const SecretContent = () => {
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
      <SecretOverview secret={entity} />
      <SecretConfiguration secret={entity} />
      <SecretResources secret_id={entity.id} />
      <DangerZoneCard />
    </Box>
  );
};
