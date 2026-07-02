import { useMemo } from "react";

import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityResources } from "../../resources/components/EntityResources";

import { WorkspaceConfiguration } from "./WorkspaceConfiguration";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { WorkspacePermissions } from "./WorkspacePermissions";
import { WorkspacePullRequests } from "./WorkspacePullRequests";
import { WorkspaceRepository } from "./WorkspaceRepository";

const METADATA_PROVIDERS = ["github", "bitbucket", "azure_devops"];

export const WorkspaceContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ workspace_id: entity?.id }),
    [entity?.id],
  );
  if (!entity) return null;

  const hasMetadata = METADATA_PROVIDERS.includes(entity.workspaceProvider);

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <WorkspaceConfiguration workspace={entity} />,
    },
    {
      label: "Resources",
      tabLabel: `Resources (${entity.resourcesCount ?? 0})`,
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_workspace_resources"
        />
      ),
    },
    ...(hasMetadata
      ? [
          {
            label: "Repository",
            content: <WorkspaceRepository workspace={entity} />,
          },
          {
            label: "Pull Requests",
            content: <WorkspacePullRequests workspace={entity} />,
          },
        ]
      : []),
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
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <WorkspaceOverview workspace={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
