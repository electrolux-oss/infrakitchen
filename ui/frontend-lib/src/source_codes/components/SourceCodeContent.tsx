import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { SourceCodeDependencies } from "./SourceCodeDependencies";
import { SourceCodeGitOverview } from "./SourceCodeGitOverview";
import { SourceCodeOverview } from "./SourceCodeOverview";

export const SourceCodeContent = () => {
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
      <SourceCodeOverview sourceCode={entity} />
      <SourceCodeGitOverview sourceCode={entity} />
      <SourceCodeDependencies source_code_id={entity.id} />
      <DangerZoneCard />
    </Box>
  );
};
