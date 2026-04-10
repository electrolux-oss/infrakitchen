import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { WorkspaceConfiguration } from "./WorkspaceConfiguration";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { WorkspacePullRequests } from "./WorkspacePullRequests";
import { WorkspaceRepository } from "./WorkspaceRepository";
import { WorkspaceResources } from "./WorkspaceResources";

const METADATA_PROVIDERS = ["github", "bitbucket", "azure_devops"];

export const WorkspaceContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const hasMetadata = METADATA_PROVIDERS.includes(entity.workspace_provider);

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <WorkspaceConfiguration workspace={entity} />,
    },
    {
      label: "Resources",
      content: <WorkspaceResources workspace_id={entity.id} />,
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
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `workspace:${entity.id}`,
      permissionAction: "write" as const,
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
