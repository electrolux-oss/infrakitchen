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

import { SecretConfiguration } from "./SecretConfiguration";
import { SecretOverview } from "./SecretOverview";

export const SecretContent = () => {
  const { entity } = useEntityProvider();

  const fixedFilters = useMemo(
    () => ({ secret_ids__any: [entity?.id] }),
    [entity?.id],
  );

  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <SecretConfiguration secret={entity} />,
    },
    {
      label: "Resources",
      tabLabel: `Resources (${entity.resources_count ?? 0})`,
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_secret_resources"
        />
      ),
    },
    {
      label: "Executors",
      tabLabel: `Executors (${entity.executors_count ?? 0})`,
      content: (
        <EntityExecutors
          fixedFilters={{ secret_ids__any: [entity.id] }}
          filterStorageKey="filter_secret_executors"
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
      requiredPermission: "api:secret",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:secret",
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <SecretOverview secret={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
