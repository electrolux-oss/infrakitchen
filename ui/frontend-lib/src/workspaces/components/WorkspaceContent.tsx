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
import { EntityResources } from "../../resources/components/EntityResources";

import { WorkspaceConfiguration } from "./WorkspaceConfiguration";
import { WorkspacePermissions } from "./WorkspacePermissions";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export const WorkspaceContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ workspace_id: entity?.id }),
    [entity?.id],
  );
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <WorkspaceConfiguration workspace={entity} />,
    },
    {
      label: "Resources",
      tabLabel: (
        <TabCountLabel label="Resources" count={entity.resourcesCount ?? 0} />
      ),
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_workspace_resources"
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Policies",
      content: <WorkspacePermissions workspace={entity} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `workspace:${entity.id}`,
      permissionAction: "admin" as const,
    },
  ];

  return (
    <EntitySidebarLayout sidebar={<WorkspaceSidebar workspace={entity} />}>
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
