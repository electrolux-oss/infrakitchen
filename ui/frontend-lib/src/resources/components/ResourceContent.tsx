import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
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
      label: "Template",
      content: <TemplateConfiguration resource={entity} />,
    },
    {
      label: "Dependencies",
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
      label: "Policies",
      content: <ResourcePermissions resource={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Revisions",
      content: (
        <Box sx={{ maxWidth: 1000 }}>
          <Revision resourceId={entity.id} resourceRevision={0} />
        </Box>
      ),
      requiredPermission: "api:resource",
      permissionAction: "write",
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
