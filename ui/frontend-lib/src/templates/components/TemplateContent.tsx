import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { EntityTreeViewTab } from "../../common/components/tree/TreeViewTab";
import { useEntityProvider } from "../../common/context/EntityContext";

import { TemplateOverview } from "./TemplateOverview";
import { TemplateResources } from "./TemplateResources";

export const TemplateContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Resources",
      content: <TemplateResources template_id={entity.id} />,
    },
    {
      label: "Tree View",
      content: (
        <EntityTreeViewTab
          entity_id={entity.id}
          entity_name={entity._entity_name}
        />
      ),
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `api:template`,
      permissionAction: "write",
    },
  ];

  return (
    <Box
      sx={{
        gap: 2,
        minWidth: 1000,
      }}
    >
      <TemplateOverview template={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
