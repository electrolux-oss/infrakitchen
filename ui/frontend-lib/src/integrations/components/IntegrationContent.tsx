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
import { EntityStorages } from "../../storages/components/EntityStorages";

import { IntegrationConfiguration } from "./IntegrationConfiguration";
import { IntegrationPermissions } from "./IntegrationPermissions";
import { IntegrationSidebar } from "./IntegrationSidebar";
import { IntegrationSourceCodeDependencies } from "./IntegrationSourceCodeDependencies";
import { IntegrationWorkspaceDependencies } from "./IntegrationWorkspaceDependencies";

export const IntegrationContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ integration_ids__any: [entity?.id] }),
    [entity?.id],
  );
  if (!entity) return null;

  const isGit = entity.integrationType === "git";
  const isCloud = entity.integrationType === "cloud";

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <IntegrationConfiguration integration={entity} />,
    },
    ...(isGit
      ? [
          {
            label: "Code Repositories",
            tabLabel: (
              <TabCountLabel
                label="Code Repositories"
                count={entity.sourceCodeCount ?? 0}
              />
            ),
            content: (
              <IntegrationSourceCodeDependencies integration_id={entity.id} />
            ),
          },
          {
            label: "Workspaces",
            tabLabel: (
              <TabCountLabel
                label="Workspaces"
                count={entity.workspaceCount ?? 0}
              />
            ),
            content: (
              <IntegrationWorkspaceDependencies integration_id={entity.id} />
            ),
          },
        ]
      : []),
    ...(isCloud
      ? [
          {
            label: "Resources",
            tabLabel: (
              <TabCountLabel
                label="Resources"
                count={entity.resourceCount ?? 0}
              />
            ),
            content: (
              <EntityResources
                fixedFilters={fixedFilters}
                filterStorageKey="filter_integration_resources"
              />
            ),
          },
        ]
      : []),
    {
      label: "Executors",
      tabLabel: (
        <TabCountLabel label="Executors" count={entity.executorCount ?? 0} />
      ),
      content: (
        <EntityExecutors
          fixedFilters={{ integration_ids__any: [entity.id] }}
          filterStorageKey="filter_integration_executors"
        />
      ),
    },
    {
      label: "Storages",
      tabLabel: (
        <TabCountLabel label="Storages" count={entity.storageCount ?? 0} />
      ),
      content: (
        <EntityStorages
          fixedFilters={{ integration_id: entity.id }}
          filterStorageKey="filter_integration_storages"
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} showRevisionColumn />,
    },
    {
      label: "Policies",
      content: <IntegrationPermissions integration={entity} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `integration:${entity.id}`,
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `integration:${entity.id}`,
      permissionAction: "admin" as const,
    },
  ];

  return (
    <EntitySidebarLayout sidebar={<IntegrationSidebar integration={entity} />}>
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
