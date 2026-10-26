import { useMemo } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { TopologyTab } from "../../common/components/graph/TopologyTab";
import { CountLabel } from "../../common/components/labels";
import { MarkdownViewer } from "../../common/components/viewers/MarkdownViewer";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";
import { EntitySourceCodeVersions } from "../../source_code_versions/components/EntitySourceCodeVersions";
import { Card, CardContent } from "../../ui";

import { TemplateSidebar } from "./TemplateSidebar";

export const TemplateContent = () => {
  const { entity } = useEntityProvider();

  const fixedFilters = useMemo(
    () => ({ template_id: [entity?.id] }),
    [entity?.id],
  );

  if (!entity) return null;

  const tabs: TabDefinition[] = [
    ...(entity.documentation
      ? [
          {
            label: "Documentation",
            content: (
              <Card>
                <CardContent>
                  <MarkdownViewer content={entity.documentation} />
                </CardContent>
              </Card>
            ),
          },
        ]
      : []),
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
      label: "Template Versions",
      tabLabel: (
        <CountLabel
          label="Template Versions"
          count={entity.sourceCodeVersionsCount ?? 0}
        />
      ),
      content: (
        <EntitySourceCodeVersions
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_source_code_versions"
        />
      ),
    },
    {
      label: "Topology",
      content: (
        <TopologyTab entity_id={entity.id} entity_name={entity.entityName} />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} showRevisionColumn />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `api:template`,
      permissionAction: "write",
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `api:template`,
      permissionAction: "write",
    },
  ];

  return (
    <EntitySidebarLayout sidebar={<TemplateSidebar template={entity} />}>
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
