import { useState } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";

import { ServiceNotificationSubscribersTable } from "./ServiceNotificationSubscribersTable";
import { ServicePermissions } from "./ServicePermissions";
import { ServiceSidebar } from "./ServiceSidebar";

export const ServiceContent = () => {
  const [subscribersRefreshKey, setSubscribersRefreshKey] = useState(0);
  const { entity, userEntityPermissions } = useEntityProvider();

  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Policies",
      content: <ServicePermissions service={entity} />,
    },
    {
      label: "Notifications",
      content: (
        <ServiceNotificationSubscribersTable
          serviceId={entity.id}
          key={subscribersRefreshKey}
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `service:${entity.id}`,
      permissionAction: "write",
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `service:${entity.id}`,
      permissionAction: "write",
    },
  ];

  return (
    <EntitySidebarLayout
      sidebar={
        <ServiceSidebar
          service={entity}
          onSubscriptionChange={() =>
            setSubscribersRefreshKey((currentKey) => currentKey + 1)
          }
        />
      }
    >
      <TabbedContent
        tabs={tabs}
        userEntityPermissions={userEntityPermissions}
      />
    </EntitySidebarLayout>
  );
};
