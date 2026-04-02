import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { IntegrationConfiguration } from "./IntegrationConfiguration";
import { IntegrationOverview } from "./IntegrationOverview";
import { IntegrationResources } from "./IntegrationResources";
import { IntegrationSourceCodeDependencies } from "./IntegrationSourceCodeDependencies";
import { IntegrationWorkspaceDependencies } from "./IntegrationWorkspaceDependencies";

export const IntegrationContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const isGit = entity.integration_type === "git";
  const isCloud = entity.integration_type === "cloud";

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <IntegrationConfiguration integration={entity} />,
    },
    ...(isGit
      ? [
          {
            label: "Code Repositories",
            content: (
              <IntegrationSourceCodeDependencies integration_id={entity.id} />
            ),
          },
          {
            label: "Workspaces",
            content: (
              <IntegrationWorkspaceDependencies integration_id={entity.id} />
            ),
          },
        ]
      : []),
    ...(isCloud
      ? [
          {
            label: "Resources",
            content: <IntegrationResources integration_id={entity.id} />,
          },
        ]
      : []),
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: "api:integration",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:integration",
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <IntegrationOverview integration={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
