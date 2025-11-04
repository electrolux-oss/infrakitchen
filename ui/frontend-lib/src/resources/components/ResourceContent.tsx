import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { EntityTreeView } from "../../common/components/tree/TreeView";
import { useEntityProvider } from "../../common/context/EntityContext";

import { AdvancedSettings } from "./AdvancedSettings";
import { DependencyConfiguration } from "./DependencyConfiguration";
import { ResourceOverview } from "./ResourceOverview";
import { ResourcePermissions } from "./ResourcePermissions";
import { TemplateConfiguration } from "./TemplateConfiguration";

export const ResourceContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <ResourceOverview resource={entity} />
      <TemplateConfiguration resource={entity} />
      <DependencyConfiguration resource={entity} />
      <EntityTreeView entity_id={entity.id} entity_name={entity._entity_name} />
      <AdvancedSettings resource={entity} />
      <ResourcePermissions resource={entity} />
      <DangerZoneCard />
    </Box>
  );
};
