import { Box } from "@mui/material";

import { DangerZoneCard } from "../../common/components/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { SourceCodeVersionResponse } from "../types";

import { SourceCodeVersionOverview } from "./SourceCodeVersionOverview";
import { SourceCodeVersionParameters } from "./SourceCodeVersionParameters";
import { SourceCodeVersionResources } from "./SourceCodeVersionResources";

export const SourceCodeVersionContent = () => {
  const { entity } = useEntityProvider();
  const source_code_version = entity as SourceCodeVersionResponse;
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: "100%",
      }}
    >
      <SourceCodeVersionOverview source_code_version={source_code_version} />
      <SourceCodeVersionParameters source_code_version={source_code_version} />
      <SourceCodeVersionResources
        source_code_version_id={source_code_version.id}
      />
      <DangerZoneCard />
    </Box>
  );
};
