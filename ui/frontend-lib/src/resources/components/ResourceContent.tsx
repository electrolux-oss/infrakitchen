import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { EntityLogs } from "../../common/components/activity/EntityLogs";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { EntityTreeViewTab } from "../../common/components/tree/TreeViewTab";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";

import { DependencyConfiguration } from "./DependencyConfiguration";
import { ResourceNotificationSubscribersTable } from "./ResourceNotificationSubscribersTable";
import { ResourceOverview } from "./ResourceOverview";
import { ResourcePermissions } from "./ResourcePermissions";
import { TemplateConfiguration } from "./TemplateConfiguration";

interface ResourceContentProps {
  subscribersRefreshKey?: number;
}

export const ResourceContent = ({
  subscribersRefreshKey = 0,
}: ResourceContentProps) => {
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
          entity_name={entity.entityName}
        />
      ),
    },
    {
      label: "Policies",
      content: <ResourcePermissions resource={entity} />,
    },
    {
      label: "Notifications",
      content: (
        <ResourceNotificationSubscribersTable
          resourceId={entity.id}
          key={subscribersRefreshKey}
        />
      ),
    },
    {
      label: "Logs",
      content: (
        <EntityLogs
          entityId={entity.id}
          sourceCodeLanguage={
            entity.source_code_version?.source_code?.sourceCodeLanguage
          }
        />
      ),
    },
    {
      label: "Audit",
      content: (
        <Audit
          entityId={entity.id}
          sourceCodeLanguage={
            entity.source_code_version?.source_code?.sourceCodeLanguage
          }
          showRevisionColumn
          showTimelineView
        />
      ),
    },

    {
      label: "Revisions",
      content: (
        <Box sx={{ width: "100%" }}>
          <Revision resourceId={entity.id} resourceRevision={0} />
        </Box>
      ),
      requiredPermission: `resource:${entity.id}`,
      permissionAction: "write",
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `resource:${entity.id}`,
      permissionAction: "write",
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <ResourceOverview resource={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
