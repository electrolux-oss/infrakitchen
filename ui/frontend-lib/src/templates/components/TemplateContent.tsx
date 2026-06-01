import { useMemo } from "react";

import { Box, Card, CardContent, Chip } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { MarkdownViewer } from "../../common/components/MarkdownViewer";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { EntityTreeViewTab } from "../../common/components/tree/TreeViewTab";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";
import { EntitySourceCodeVersions } from "../../source_code_versions/components/EntitySourceCodeVersions";

import { TemplateOverview } from "./TemplateOverview";

export const TemplateContent = () => {
  const { entity } = useEntityProvider();

  const fixedFilters = useMemo(
    () => ({ template_id: [entity?.id] }),
    [entity?.id],
  );

  if (!entity) return null;

  const tabs: TabDefinition[] = [
    ...(entity.documentation
      ? [
          {
            label: "Documentation",
            content: (
              <Card sx={{ position: "relative", overflow: "visible" }}>
                <Chip
                  label="Template Documentation"
                  size="small"
                  color="info"
                  variant="filled"
                  sx={{
                    position: "absolute",
                    top: -10,
                    left: 16,
                    zIndex: 1,
                  }}
                />
                <CardContent>
                  <MarkdownViewer content={entity.documentation} />
                </CardContent>
              </Card>
            ),
          },
        ]
      : []),
    {
      label: "Resources",
      tabLabel: `Resources (${entity.resources_count ?? 0})`,
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_resources"
        />
      ),
    },
    {
      label: "Template Versions",
      tabLabel: `Template Versions (${entity.source_code_versions_count ?? 0})`,
      content: (
        <EntitySourceCodeVersions
          fixedFilters={fixedFilters}
          filterStorageKey="filter_storage_source_code_versions"
        />
      ),
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
      label: "Audit",
      content: <Audit entityId={entity.id} showRevisionColumn />,
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `api:template`,
      permissionAction: "write",
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
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
      }}
    >
      <TemplateOverview template={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
