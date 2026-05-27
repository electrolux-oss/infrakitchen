import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Tooltip } from "@mui/material";

import { useEntityProvider } from "../../common/context/EntityContext";
import { PropertyCard } from "../../common/components/PropertyCard";
import { ResourceWiringDiagram } from "../../source_code_versions/components/ResourceWiringDiagram";

export const TemplateGraph = () => {
  const { entity } = useEntityProvider();

  return (
    <PropertyCard
      title="Template Resources"
      action={
        <Tooltip
          title="Shows all resources that will be created from the selected template version."
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
        templateId={entity?.id}
        showVersionSelector
        allowFullscreen
      />
    </PropertyCard>
  );
};
