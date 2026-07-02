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

import { StorageConfiguration } from "./StorageConfiguration";
import { StorageOverview } from "./StorageOverview";

export const StorageContent = () => {
  const { entity } = useEntityProvider();
  const fixedFilters = useMemo(
    () => ({ storage_id: entity?.id }),
    [entity?.id],
  );
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <StorageConfiguration storage={entity} />,
    },
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
      label: "Executors",
      tabLabel: `Executors (${entity.executorsCount ?? 0})`,
      content: (
        <EntityExecutors
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_executors"
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: "api:storage",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:storage",
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <StorageOverview storage={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
