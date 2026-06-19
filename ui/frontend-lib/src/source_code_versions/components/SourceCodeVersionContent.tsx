import { useMemo } from "react";

import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { HclItemList } from "../../common/components/HclItemList";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";
import { GqlSourceCodeVersion } from "../graphql";

import { CodeSnapshotTab } from "./CodeSnapshotTab";
import { InputTab } from "./InputTab";
import { ConfigurationTabContent } from "./SourceCodeRefRow";
import { SourceCodeVersionOverview } from "./SourceCodeVersionOverview";

export const SourceCodeVersionContent = () => {
  const { entity } = useEntityProvider();
  const source_code_version = entity as GqlSourceCodeVersion;
  const fixedFilters = useMemo(
    () => ({ source_code_version_id: source_code_version?.id }),
    [source_code_version?.id],
  );
  if (!source_code_version) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Inputs",
      content: <InputTab source_code_version={source_code_version} />,
    },
    {
      label: "Outputs",
      content: (
        <Box sx={{ pt: 0.5 }}>
          {source_code_version.outputs ? (
            <HclItemList items={source_code_version.outputs} type="outputs" />
          ) : (
            "No outputs defined."
          )}
        </Box>
      ),
    },
    {
      label: "Configuration",
      content: <ConfigurationTabContent entity={source_code_version} />,
    },
    {
      label: "Code",
      content: (
        <CodeSnapshotTab
          codeSnapshot={source_code_version.codeSnapshot}
          defaultRef={
            source_code_version.sourceCodeVersion ||
            source_code_version.sourceCodeBranch ||
            "N/A"
          }
        />
      ),
    },
    {
      label: `Resources`,
      tabLabel: `Resources (${source_code_version.resourcesCount ?? 0})`,
      content: (
        <EntityResources
          fixedFilters={fixedFilters}
          filterStorageKey="filter_sourcecodeversion_resources"
        />
      ),
    },
    {
      label: "Audit",
      content: <Audit entityId={source_code_version.id} />,
    },
    {
      label: "Revisions",
      content: (
        <Revision resourceId={source_code_version.id} resourceRevision={0} />
      ),
      requiredPermission: "api:source_code_version",
      permissionAction: "write" as const,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:source_code_version",
      permissionAction: "write" as const,
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <SourceCodeVersionOverview source_code_version={source_code_version} />
      <TabbedContent tabs={tabs} />
    </Box>
  );
};
