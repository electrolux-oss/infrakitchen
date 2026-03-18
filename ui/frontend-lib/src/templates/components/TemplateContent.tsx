import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { EntityTreeView } from "../../common/components/tree/TreeView";
import { useEntityProvider } from "../../common/context/EntityContext";

import { TemplateOverview } from "./TemplateOverview";
import { TemplateResources } from "./TemplateResources";

export const TemplateContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: 1000,
      }}
    >
      <TemplateOverview template={entity} />
      <TemplateResources template_id={entity.id} />
      <EntityTreeView entity_id={entity.id} entity_name={entity._entity_name} />
      <DangerZoneCard />
    </Box>
  );
};
