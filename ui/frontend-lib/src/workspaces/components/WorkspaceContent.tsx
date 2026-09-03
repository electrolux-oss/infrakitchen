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

export const WorkspaceContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ workspace_id: entity?.id }),
    [entity?.id],
  );
  if (!entity) return null;

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
