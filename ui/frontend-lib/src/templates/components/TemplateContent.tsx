import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { EntityTreeView } from "../../common/components/tree/TreeView";
import { useEntityProvider } from "../../common/context/EntityContext";

import { TemplateOverview } from "./TemplateOverview";
import { TemplateResources } from "./TemplateResources";
import { TemplateSourceCodeVersions } from "./TemplateSourceCodeVersions";

export const TemplateContent = () => {
  const { entity } = useEntityProvider();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <TemplateOverview template={entity} />
      <TemplateSourceCodeVersions template_id={entity.id} />
      <TemplateResources template_id={entity.id} />
      <EntityTreeView entity_id={entity.id} entity_name={entity._entity_name} />
      <DangerZoneCard />
    </Box>
  );
};
