import { Audit } from "../../common/components/activity/Audit";
import { EntityLogs } from "../../common/components/activity/EntityLogs";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";
import { EntityTaskQueueStatus } from "../../workers/components";

import { AdvancedSettings } from "./AdvancedSettings";
import { ExecutorPermissions } from "./ExecutorPermissions";
import { ExecutorSidebar } from "./ExecutorSidebar";

export const ExecutorContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <AdvancedSettings executor={entity} />,
    },
    {
      label: "Policies",
      content: <ExecutorPermissions executor={entity} />,
    },
    {
      label: "Logs",
      content: (
        <EntityLogs entityId={entity.id} sourceCodeLanguage={"opentofu"} />
      ),
    },
    {
      label: "Audit",
      content: (
        <Audit
          entityId={entity.id}
          showRevisionColumn
          showTimelineView
          sourceCodeLanguage={"opentofu"}
        />
      ),
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `executor:${entity.id}`,
      permissionAction: "write",
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `executor:${entity.id}`,
      permissionAction: "write",
    },
  ];

  return (
    <EntitySidebarLayout sidebar={<ExecutorSidebar executor={entity} />}>
      <EntityTaskQueueStatus />
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
