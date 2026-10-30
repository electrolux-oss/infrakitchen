import { useState } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { CountLabel } from "../../common/components/labels";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";
import { Alert } from "../../ui";
import { GqlServiceSourceCode } from "../graphql/transforms";

import { ServiceBuilds } from "./ServiceBuilds";
import { ServiceCommits } from "./ServiceCommits";
import { ServiceNotificationSubscribersTable } from "./ServiceNotificationSubscribersTable";
import { ServicePermissions } from "./ServicePermissions";
import { ServiceSidebar } from "./ServiceSidebar";

export const ServiceContent = () => {
  const [subscribersRefreshKey, setSubscribersRefreshKey] = useState(0);
  const { entity, userEntityPermissions } = useEntityProvider();

  if (!entity) return null;

  const sourceCode: GqlServiceSourceCode | null = entity.sourceCode;

  const tabs: TabDefinition[] = [
    {
      label: "Commits",
      tabLabel: sourceCode ? (
        <CountLabel label="Commits" count={sourceCode.commitCount} />
      ) : undefined,
      content: sourceCode ? (
        <ServiceCommits service={entity} sourceCode={sourceCode} />
      ) : (
        <Alert className="mt-2" severity="info">
          Link an application code repository to this service to see its
          commits.
        </Alert>
      ),
    },
    {
      label: "Builds",
      content: <ServiceBuilds serviceId={entity.id} />,
    },
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
