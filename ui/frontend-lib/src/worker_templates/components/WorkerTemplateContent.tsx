import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";

import { WorkerTemplateConfiguration } from "./WorkerTemplateConfiguration";
import { WorkerTemplateInstances } from "./WorkerTemplateInstances";
import { WorkerTemplateOverview } from "./WorkerTemplateOverview";

export const WorkerTemplateContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <WorkerTemplateConfiguration workerTemplate={entity} />,
    },
    {
      label: "Instances",
      content: <WorkerTemplateInstances workerTemplateId={entity.id} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: "api:worker_template",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:worker_template",
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <WorkerTemplateOverview workerTemplate={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
