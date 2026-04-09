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
import { WorkspaceResources } from "./WorkspaceResources";

export const WorkspaceContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <WorkspaceConfiguration workspace={entity} />,
    },
    {
      label: "Resources",
      content: <WorkspaceResources workspace_id={entity.id} />,
    },
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
