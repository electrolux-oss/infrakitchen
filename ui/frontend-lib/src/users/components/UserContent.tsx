import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { UserPoliciesCard } from "../../permissions/components/policies/UserPoliciesCard";
import { UserRolesCard } from "../../permissions/components/roles/UserRolesCard";

import { UserConfiguration } from "./UserConfiguration";
import { UserOverview } from "./UserOverview";

export const UserContent = () => {
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
      <UserOverview user={entity} />
      <UserConfiguration user={entity} />
      <UserRolesCard user_id={entity.id} />
      <UserPoliciesCard user_id={entity.id} />
      <DangerZoneCard />
    </Box>
  );
};
