import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Tooltip, Typography } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { ResourceWiringDiagram } from "./ResourceWiringDiagram";

export const SourceCodeVersionGraph = () => {
  const { entity } = useEntityProvider();

  if (!entity?.id || !entity?.template?.id) {
    return (
      <PropertyCard title="Source Code Version Graph">
        <Typography color="text.secondary">Source code version not selected.</Typography>
      </PropertyCard>
    );
  }

  return (
    <PropertyCard
      title="Source Code Version Graph"
      subtitle={entity?.source_code?.source_code_url}
      action={
        <Tooltip
          title="Graph of provisioned resources for this source code version."
          placement="left"
        >
          <InfoOutlinedIcon
            fontSize="small"
            sx={{ color: "text.secondary", cursor: "help" }}
          />
        </Tooltip>
      }
    >
      <ResourceWiringDiagram
        templateId={entity.template.id}
        scvId={entity.id}
        allowFullscreen
      />
    </PropertyCard>
  );
};
