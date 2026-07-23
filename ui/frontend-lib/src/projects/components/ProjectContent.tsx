import { useMemo } from "react";

import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { DependencyConfiguration } from "../../resources/components/DependencyConfiguration";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";
import { UPDATE_PROJECT_MUTATION } from "../graphql/mutations";

import { ProjectOverview } from "./ProjectOverview";
import { ProjectPermissions } from "./ProjectPermissions";
import { ProjectSettings } from "./ProjectSettings";

export const ProjectContent = () => {
  const { entity, userEntityPermissions } = useEntityProvider();

  const fixedFilters = useMemo(
    () => ({ project_id: [entity?.id] }),
    [entity?.id],
  );

  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Resources",
      tabLabel: `Resources (${entity.resourcesCount ?? 0})`,
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_resources"
        />
      ),
    },
    {
      label: "Dependencies",
      content: (
        <DependencyConfiguration
          resource={entity}
          updateMutation={UPDATE_PROJECT_MUTATION}
          toUpdateInput={(input) => ({
            dependencyTags: input.dependencyTags,
            dependencyConfig: input.dependencyConfig,
          })}
          permissionEntity="api:project"
        />
      ),
    },
    {
      label: "Policies",
      content: <ProjectPermissions project={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `project:${entity.id}`,
      permissionAction: "write",
    },
    {
      label: "Settings",
      content: (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <ProjectSettings project={entity} />
          <DangerZoneCard />
        </Box>
      ),
      requiredPermission: `project:${entity.id}`,
      permissionAction: "write",
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <ProjectOverview project={entity} />
      <TabbedContent
        tabs={tabs}
        userEntityPermissions={userEntityPermissions}
      />
    </Box>
  );
};
