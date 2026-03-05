import { Box } from "@mui/material";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { EntityTreeViewTab } from "../../common/components/tree/TreeViewTab";
import { useEntityProvider } from "../../common/context/EntityContext";

import { DependencyConfiguration } from "./DependencyConfiguration";
import { ResourceOverview } from "./ResourceOverview";
import { ResourcePermissions } from "./ResourcePermissions";
import { TemplateConfiguration } from "./TemplateConfiguration";

export const ResourceContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Template Configuration",
      content: <TemplateConfiguration resource={entity} />,
    },
    {
      label: "Dependency Configuration",
      content: <DependencyConfiguration resource={entity} />,
    },
    {
      label: "Tree View",
      content: (
        <EntityTreeViewTab
          entity_id={entity.id}
          entity_name={entity._entity_name}
        />
      ),
    },
    {
      label: "Resource Policy",
      content: <ResourcePermissions resource={entity} />,
    },
    {
      label: "Activity",
      content: (
        <Box sx={{ mt: -8 }}>
          <ActivityContainer
            tabs={["audit", "revisions"]}
            disableOnBack={true}
            disableTitle={true}
          />
        </Box>
      ),
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:resource",
      permissionAction: "admin",
    },
  ];

  return (
    <Box sx={{ gap: 2, minWidth: 1000 }}>
      <ResourceOverview resource={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
