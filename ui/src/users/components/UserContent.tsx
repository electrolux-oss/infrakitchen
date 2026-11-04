import { Audit } from "../../common/components/activity/Audit";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { UserPoliciesCard } from "../../permissions/components/policies/UserPoliciesCard";
import { UserRolesCard } from "../../permissions/components/roles/UserRolesCard";

import { UserConfiguration } from "./UserConfiguration";
import { UserDangerZone } from "./UserDangerZone";
import { UserNotificationPreferencesCard } from "./UserNotificationPreferencesCard";
import { UserNotificationSubscriptionsCard } from "./UserNotificationSubscriptionsCard";
import { UserPersonalAccessTokensCard } from "./UserPersonalAccessTokensCard";
import { UserSidebar } from "./UserSidebar";

export const UserContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: (
        <div className="flex w-full flex-col gap-4">
          <UserConfiguration user={entity} />
          <UserPersonalAccessTokensCard user={entity} />
        </div>
      ),
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
        <div className="flex flex-col gap-4">
          <UserNotificationPreferencesCard
            user_id={entity.id}
            slackId={entity.meta?.slackId}
          />
          <UserNotificationSubscriptionsCard user_id={entity.id} />
        </div>
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
  ];

  // Only service accounts can be deleted; other users can only be deactivated.
  if (entity.provider === "ik_service_account") {
    tabs.push({
      label: "Settings",
      content: <UserDangerZone user={entity} />,
      requiredPermission: "api:user",
      permissionAction: "write" as const,
    });
  }

  return (
    <EntitySidebarLayout sidebar={<UserSidebar user={entity} />}>
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
