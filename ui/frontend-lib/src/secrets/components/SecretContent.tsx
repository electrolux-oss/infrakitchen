import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { SecretConfiguration } from "./SecretConfiguration";
import { SecretOverview } from "./SecretOverview";
import { SecretResources } from "./SecretResources";

export const SecretContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <SecretConfiguration secret={entity} />,
    },
    {
      label: "Resources",
      content: <SecretResources secret_id={entity.id} />,
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
