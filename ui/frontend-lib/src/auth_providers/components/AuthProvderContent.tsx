import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { AuthProviderResponse } from "../types";

import { AuthProviderConfiguration } from "./AuthProviderConfiguration";
import { AuthProviderOverview } from "./AuthProviderOverview";

export interface AuthProviderContentProps {
  auth_provider: AuthProviderResponse;
}

export const AuthProviderContent = () => {
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
      <AuthProviderOverview authProvider={entity} />
      <AuthProviderConfiguration auth_provider={entity} />
      <DangerZoneCard />
    </Box>
  );
};
