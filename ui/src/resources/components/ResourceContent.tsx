import { useState } from "react";

import { Audit } from "../../common/components/activity/Audit";
import { EntityLogs } from "../../common/components/activity/EntityLogs";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { TopologyTab } from "../../common/components/graph/TopologyTab";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";
import { EntityTaskQueueStatus } from "../../workers/components";

import { DependencyConfiguration } from "./DependencyConfiguration";
import { ResourceNotificationSubscribersTable } from "./ResourceNotificationSubscribersTable";
import { ResourcePermissions } from "./ResourcePermissions";
import { ResourceReviewView } from "./ResourceReviewView";
import { ResourceSidebar } from "./ResourceSidebar";
import {
  ResourceVariablesEditor,
  TemplateConfiguration,
} from "./TemplateConfiguration";

export const ResourceContent = () => {
  const [subscribersRefreshKey, setSubscribersRefreshKey] = useState(0);
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);
  const { entity, userEntityPermissions } = useEntityProvider();

  if (!entity) return null;

  const openVariablesDialog = () => setVariablesDialogOpen(true);

  const tabs: TabDefinition[] = [
    {
      // Template/version/storage/tool live in the sidebar now; this tab carries
      // the input/output variables (non-abstract only, handled inside the
      // component) together with the dependency configuration. The cards
      // stack in a column and share a single row of equal columns from xl up.
      label: "Template",
      content: (
        <div className="grid [grid-auto-columns:minmax(0,_1fr)] [grid-auto-flow:row] grid-cols-[minmax(0,_1fr)] items-start gap-4 xl:[grid-auto-flow:column]">
          <TemplateConfiguration
            resource={entity}
            onEditVariables={openVariablesDialog}
          />
          <DependencyConfiguration resource={entity} />
        </div>
      ),
    },
    {
      label: "Topology",
      content: (
        <TopologyTab entity_id={entity.id} entity_name={entity.entityName} />
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
          projectId={entity.project?.id}
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
            entity.sourceCodeVersion?.sourceCode?.sourceCodeLanguage
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
            entity.sourceCodeVersion?.sourceCode?.sourceCodeLanguage
          }
          showRevisionColumn
          showTimelineView
        />
      ),
    },

    {
      label: "Revisions",
      content: (
        <div className="w-full">
          <Revision resourceId={entity.id} resourceRevision={0} />
        </div>
      ),
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
    },
  ];

  return (
    <EntitySidebarLayout
      banner={<ResourceReviewView />}
      sidebar={
        <ResourceSidebar
          resource={entity}
          onEditVariables={openVariablesDialog}
          onSubscriptionChange={() =>
            setSubscribersRefreshKey((currentKey) => currentKey + 1)
          }
        />
      }
    >
      <EntityTaskQueueStatus />
      <TabbedContent
        tabs={tabs}
        userEntityPermissions={userEntityPermissions}
      />
      {/* Lives outside the tabs so the sidebar can open it from any tab. */}
      <ResourceVariablesEditor
        resource={entity}
        open={variablesDialogOpen}
        onClose={() => setVariablesDialogOpen(false)}
      />
    </EntitySidebarLayout>
  );
};
