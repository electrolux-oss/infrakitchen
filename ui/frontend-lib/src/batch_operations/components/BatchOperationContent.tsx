import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { BatchOperationEntities } from "./BatchOperationEntities";
import { BatchOperationErrorEntities } from "./BatchOperationErrorEntities";
import { BatchOperationOverview } from "./BatchOperationOverview";

export const BatchOperationContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Entities",
      content: <BatchOperationEntities batchOperation={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:batch_operation",
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <BatchOperationOverview batchOperation={entity} />
      <BatchOperationErrorEntities batchOperation={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
