import { useMemo } from "react";

import { Box, Chip, Grid, Typography } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { EntitySidebarLayout } from "../../common/components/cards/EntitySidebar";
import {
  TabbedContent,
  TabCountLabel,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { HclItemList } from "../../common/components/hcl/HclItemList";
import { useEntityProvider } from "../../common/context/EntityContext";
import { solidChipColorSx } from "../../common/utils/softChip";
import { EntityResources } from "../../resources/components/EntityResources";
import { Revision } from "../../revision/Revision";
import { EntityTaskQueueStatus } from "../../workers/components";
import { GqlSourceCodeVersion } from "../graphql";

import { CodeSnapshotTab } from "./CodeSnapshotTab";
import { InputTab } from "./InputTab";
import { ConfigurationTabContent } from "./SourceCodeRefRow";
import { SourceCodeVersionSidebar } from "./SourceCodeVersionSidebar";

/** Card title with an info-tinted count chip, e.g. "Input Variables" + [4]. */
const CardCountTitle = ({ title, count }: { title: string; count: number }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    {/* Inherit the card-title styling so this header matches the
        plain-string titles used by the other cards. */}
    <Typography component="span" variant="inherit">
      {title}
    </Typography>
    <Chip label={String(count)} sx={solidChipColorSx("info")} />
  </Box>
);

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
      // Inputs and outputs share one tab: the cards stack in a column and sit
      // side by side in equal columns from xl up.
      label: "Variables",
      content: (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            alignItems: "start",
            gridTemplateColumns: "minmax(0, 1fr)",
            gridAutoFlow: { xs: "row", xl: "column" },
            gridAutoColumns: "minmax(0, 1fr)",
          }}
        >
          <BaseCard
            name={
              <CardCountTitle
                title="Input Variables"
                count={source_code_version.variables?.length ?? 0}
              />
            }
          >
            <Grid size={12}>
              <InputTab source_code_version={source_code_version} />
            </Grid>
          </BaseCard>
          <BaseCard
            name={
              <CardCountTitle
                title="Output Values"
                count={source_code_version.outputs?.length ?? 0}
              />
            }
          >
            <Grid size={12}>
              <HclItemList
                items={source_code_version.outputs ?? []}
                type="outputs"
                emptyMessage="No output values."
              />
            </Grid>
          </BaseCard>
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
      label: "Resources",
      tabLabel: (
        <TabCountLabel
          label="Resources"
          count={source_code_version.resourcesCount ?? 0}
        />
      ),
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
    <EntitySidebarLayout
      sidebar={
        <SourceCodeVersionSidebar source_code_version={source_code_version} />
      }
    >
      <EntityTaskQueueStatus />
      <TabbedContent tabs={tabs} />
    </EntitySidebarLayout>
  );
};
