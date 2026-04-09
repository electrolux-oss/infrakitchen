import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { AdvancedSettings } from "./AdvancedSettings";
import { ExecutorOverview } from "./ExecutorOverview";
import { ExecutorPermissions } from "./ExecutorPermissions";

export const ExecutorContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <AdvancedSettings executor={entity} />,
    },
    {
      label: "Policies",
      content: <ExecutorPermissions executor={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} showRevisionColumn />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `executor:${entity.id}`,
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `executor:${entity.id}`,
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <ExecutorOverview executor={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
