import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Revision } from "../../revision/Revision";
import { SourceCodeRefSection } from "../../source_code_versions/components/SourceCodeRefSection";
import { RefType } from "../../source_code_versions/types";
import { RefFolders } from "../types";

import { SourceCodeOverview } from "./SourceCodeOverview";

export const SourceCodeContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const getFolders = (ref: string): string[] =>
    entity.git_folders_map.find((r: RefFolders) => r.ref === ref)?.folders ??
    [];

  const tabs: TabDefinition[] = [
    ...(entity.git_tags?.length
      ? [
          {
            label: `Tags`,
            tabLabel: `Tags (${entity.git_tags.length})`,
            content: (
              <SourceCodeRefSection
                refs={entity.git_tags}
                type={RefType.TAG}
                sourceCodeId={entity.id}
                getFolders={getFolders}
              />
            ),
          },
        ]
      : []),
    ...(entity.git_branches?.length
      ? [
          {
            label: `Branches`,
            tabLabel: `Branches (${entity.git_branches.length})`,
            content: (
              <SourceCodeRefSection
                refs={entity.git_branches}
                type={RefType.BRANCH}
                sourceCodeId={entity.id}
                getFolders={getFolders}
              />
            ),
          },
        ]
      : []),
    {
      label: "Audit",
      content: (
        <Audit
          entityId={entity.id}
          sourceCodeLanguage={entity.source_code_language}
          showRevisionColumn
        />
      ),
    },
    {
      label: "Revisions",
      content: <Revision resourceId={entity.id} resourceRevision={0} />,
      requiredPermission: `api:source_code`,
      permissionAction: "write",
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: `api:source_code`,
      permissionAction: "write",
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <SourceCodeOverview sourceCode={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
