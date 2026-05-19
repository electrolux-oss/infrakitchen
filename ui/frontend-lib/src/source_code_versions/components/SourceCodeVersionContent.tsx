import { Box } from "@mui/material";

import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { HclItemList } from "../../common/components/HclItemList";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";
import { InputTab } from "../../source_codes/components/InputTab";
import { ConfigurationTabContent } from "../../source_codes/components/SourceCodeRefRow";
import { SourceCodeVersionResponse } from "../../source_codes/types";

import { SourceCodeVersionOverview } from "./SourceCodeVersionOverview";
import { SourceCodeVersionResources } from "./SourceCodeVersionResources";

export const SourceCodeVersionContent = () => {
  const { entity } = useEntityProvider();
  const source_code_version = entity as SourceCodeVersionResponse;
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
          <HclItemList items={source_code_version.outputs} type="outputs" />
        </Box>
      ),
    },
    {
      label: "Configuration",
      content: <ConfigurationTabContent entity={source_code_version} />,
    },
    {
      label: "Resources",
      content: (
        <SourceCodeVersionResources
          source_code_version_id={source_code_version.id}
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
