import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { UserPoliciesCard } from "../../permissions/components/policies/UserPoliciesCard";
import { UserRolesCard } from "../../permissions/components/roles/UserRolesCard";

import { UserConfiguration } from "./UserConfiguration";
import { UserOverview } from "./UserOverview";

export const UserContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <UserConfiguration user={entity} />,
    },
    {
      label: "Roles",
      content: <UserRolesCard user_id={entity.id} />,
    },
    {
      label: "Policies",
      content: <UserPoliciesCard user_id={entity.id} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `user:${entity.id}`,
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <UserOverview user={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
