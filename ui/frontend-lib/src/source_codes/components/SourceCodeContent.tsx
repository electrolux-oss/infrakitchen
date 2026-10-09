import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import {
  TabbedContent,
  TabCountLabel,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { Revision } from "../../revision/Revision";
import { SourceCodeRefSection } from "../../source_code_versions/components/SourceCodeRefSection";
import { RefType } from "../../source_code_versions/types";
import { EntityTaskQueueStatus } from "../../workers/components";
import {
  DEFAULT_ENVIRONMENT_NAME,
  GqlIacModule,
  GqlSourceCodeTag,
} from "../graphql";
import { RefFolders } from "../types";

import { IacEnvironments } from "./iac/IacEnvironments";
import { SourceCodeCommits } from "./SourceCodeCommits";
import { SourceCodeModules } from "./SourceCodeModules";
import { SourceCodeOverview } from "./SourceCodeOverview";

export const SourceCodeContent = () => {
  const { entity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  if (!entity) return null;

  const getFolders = (ref: string): string[] =>
    entity.gitFoldersMap.find((r: RefFolders) => r.ref === ref)?.folders ?? [];

  // Modules without environments are run under "default", so it needs settings too.
  const iacEnvironmentNames: string[] = [
    ...(entity.iacEnvironmentNames ?? []),
    ...((entity.iacModules ?? []).some(
      (module: GqlIacModule) => module.environments.length === 0,
    )
      ? [DEFAULT_ENVIRONMENT_NAME]
      : []),
  ];
  const canConfigureEnvironments = checkActionPermission(
    "api:source_code",
    "admin",
  );

  const commitTags: GqlSourceCodeTag[] = (entity.gitTags ?? []).flatMap(
    (name: string) => {
      const sha = entity.gitTagShas?.[name];
      return sha ? [{ name, sha }] : [];
    },
  );

  const tabs: TabDefinition[] = [
    ...(entity.repositoryType === "iac" && entity.iacModules
      ? [
          {
            label: "Modules",
            content: <SourceCodeModules sourceCode={entity} />,
          },
          {
            label: "Environments",
            content: (
              <IacEnvironments
                sourceCodeId={entity.id}
                modules={entity.iacModules ?? []}
                environmentNames={iacEnvironmentNames}
                canEdit={canConfigureEnvironments}
              />
            ),
          },
        ]
      : []),
    ...(entity.commitCount
      ? [
          {
            label: "Commits",
            content: (
              <SourceCodeCommits
                sourceCodeId={entity.id}
                branch={entity.defaultBranch}
                total={entity.commitCount}
                tags={commitTags}
              />
            ),
          },
        ]
      : []),
    ...(entity.gitTags?.length
      ? [
          {
            label: "Tags",
            tabLabel: (
              <TabCountLabel label="Tags" count={entity.gitTags.length} />
            ),
            content: (
              <SourceCodeRefSection
                refs={entity.gitTags}
                type={RefType.TAG}
                sourceCodeId={entity.id}
                getFolders={getFolders}
              />
            ),
          },
        ]
      : []),
    ...(entity.gitBranches?.length
      ? [
          {
            label: "Branches",
            tabLabel: (
              <TabCountLabel
                label="Branches"
                count={entity.gitBranches.length}
              />
            ),
            content: (
              <SourceCodeRefSection
                refs={entity.gitBranches}
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
          sourceCodeLanguage={entity.sourceCodeLanguage}
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
      <EntityTaskQueueStatus />
      <SourceCodeOverview sourceCode={entity} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
