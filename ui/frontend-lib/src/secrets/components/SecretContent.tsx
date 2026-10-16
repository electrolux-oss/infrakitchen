import { useMemo } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabCountLabel,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityExecutors } from "../../executors/components/EntityExecutors";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";

import { SecretConfiguration } from "./SecretConfiguration";
import { SecretSidebar } from "./SecretSidebar";

export const SecretContent = () => {
  const { entity } = useEntityProvider();

  const fixedFilters = useMemo(
    () => ({ secret_ids__any: [entity?.id] }),
    [entity?.id],
  );

  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <SecretConfiguration secret={entity} />,
    },
    {
      label: "Resources",
      tabLabel: (
        <TabCountLabel label="Resources" count={entity.resourcesCount ?? 0} />
      ),
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_secret_resources"
        />
      ),
    },
    {
      label: "Executors",
      tabLabel: (
        <TabCountLabel label="Executors" count={entity.executorsCount ?? 0} />
      ),
      content: (
        <EntityExecutors
          fixedFilters={{ secret_ids__any: [entity.id] }}
          filterStorageKey="filter_secret_executors"
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
      requiredPermission: "api:secret",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:secret",
      permissionAction: "write" as const,
    },
  ];

  return (
    <EntitySidebarLayout sidebar={<SecretSidebar secret={entity} />}>
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
