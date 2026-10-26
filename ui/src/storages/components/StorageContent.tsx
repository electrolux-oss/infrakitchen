import { useMemo } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { CountLabel } from "../../common/components/labels";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityExecutors } from "../../executors/components/EntityExecutors";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";
import { EntityTaskQueueStatus } from "../../workers/components";

import { StorageConfiguration } from "./StorageConfiguration";
import { StorageSidebar } from "./StorageSidebar";

export const StorageContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ storage_id: entity?.id }),
    [entity?.id],
  );
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <StorageConfiguration storage={entity} />,
    },
    {
      label: "Resources",
      tabLabel: (
        <CountLabel label="Resources" count={entity.resourcesCount ?? 0} />
      ),
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_resources"
        />
      ),
    },
    {
      label: "Executors",
      tabLabel: (
        <CountLabel label="Executors" count={entity.executorsCount ?? 0} />
      ),
      content: (
        <EntityExecutors
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_executors"
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
      requiredPermission: "api:storage",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:storage",
      permissionAction: "write" as const,
    },
  ];

  return (
    <EntitySidebarLayout sidebar={<StorageSidebar storage={entity} />}>
      <EntityTaskQueueStatus />
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
