import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";

import { SourceCodeOverview } from "./SourceCodeOverview";
import { SourceCodeRefOverview } from "./SourceCodeRefOverview";

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
      <SourceCodeRefOverview sourceCode={entity} />
      <DangerZoneCard />
    </Box>
  );
};
