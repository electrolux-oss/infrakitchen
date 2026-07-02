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
import { UserNotificationPreferencesCard } from "./UserNotificationPreferencesCard";
import { UserNotificationSubscriptionsCard } from "./UserNotificationSubscriptionsCard";
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
      content: <UserRolesCard userId={entity.id} />,
    },
    {
      label: "Policies",
      content: <UserPoliciesCard userId={entity.id} />,
    },
    {
      label: "Notifications",
      content: (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <UserNotificationSubscriptionsCard user_id={entity.id} />
          <UserNotificationPreferencesCard user_id={entity.id} />
        </Box>
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:user",
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
