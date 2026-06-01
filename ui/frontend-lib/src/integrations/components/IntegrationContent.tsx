import { useMemo } from "react";

import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityExecutors } from "../../executors/components/EntityExecutors";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";

import { IntegrationConfiguration } from "./IntegrationConfiguration";
import { IntegrationOverview } from "./IntegrationOverview";
import { IntegrationPermissions } from "./IntegrationPermissions";
import { IntegrationSourceCodeDependencies } from "./IntegrationSourceCodeDependencies";
import { IntegrationWorkspaceDependencies } from "./IntegrationWorkspaceDependencies";

export const IntegrationContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ integration_ids__any: [entity?.id] }),
    [entity?.id],
  );
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
            label: `Code Repositories (${entity.source_code_count ?? 0})`,
            content: (
              <IntegrationSourceCodeDependencies integration_id={entity.id} />
            ),
          },
          {
            label: `Workspaces (${entity.workspace_count ?? 0})`,
            content: (
              <IntegrationWorkspaceDependencies integration_id={entity.id} />
            ),
          },
        ]
      : []),
    ...(isCloud
      ? [
          {
            label: `Resources`,
            tabLabel: `Resources (${entity.resource_count ?? 0})`,
            content: (
              <EntityResources
                fixedFilters={fixedFilters}
                filterStorageKey="filter_integration_resources"
              />
            ),
          },
        ]
      : []),
    {
      label: "Executors",
      tabLabel: `Executors (${entity.executor_count ?? 0})`,
      content: (
        <EntityExecutors
          fixedFilters={{ integration_ids__any: [entity.id] }}
          filterStorageKey="filter_integration_executors"
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} showRevisionColumn />,
    },
    {
      label: "Policies",
      content: <IntegrationPermissions integration={entity} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `integration:${entity.id}`,
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `integration:${entity.id}`,
      permissionAction: "admin" as const,
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
