import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { BatchOperationEntities } from "./BatchOperationEntities";
import { BatchOperationSidebar } from "./BatchOperationSidebar";

export const BatchOperationContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Entities",
      content: <BatchOperationEntities batchOperation={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:batch_operation",
      permissionAction: "write" as const,
    },
  ];

  return (
    <EntitySidebarLayout
      sidebar={<BatchOperationSidebar batchOperation={entity} />}
    >
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
