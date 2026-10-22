import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { WorkerTemplateConfiguration } from "./WorkerTemplateConfiguration";
import { WorkerTemplateInstances } from "./WorkerTemplateInstances";
import { WorkerTemplateSidebar } from "./WorkerTemplateSidebar";

export const WorkerTemplateContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Instances",
      content: <WorkerTemplateInstances workerTemplateId={entity.id} />,
    },
    {
      label: "Configuration",
      content: <WorkerTemplateConfiguration workerTemplate={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:worker_template",
      permissionAction: "admin" as const,
    },
  ];

  return (
    <EntitySidebarLayout
      sidebar={<WorkerTemplateSidebar workerTemplate={entity} />}
    >
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
