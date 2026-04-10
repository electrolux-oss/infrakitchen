import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { StorageConfiguration } from "./StorageConfiguration";
import { StorageOverview } from "./StorageOverview";
import { StorageResources } from "./StorageResources";

export const StorageContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <StorageConfiguration storage={entity} />,
    },
    {
      label: "Resources",
      content: <StorageResources storage_id={entity.id} />,
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
