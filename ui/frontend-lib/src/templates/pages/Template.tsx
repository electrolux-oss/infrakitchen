import { useParams, useNavigate } from "react-router";

import { Button } from "@mui/material";

import { useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { TemplateContent } from "../components/TemplateContent";

export const TemplatePage = () => {
  const { template_id } = useParams();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const handleUseTemplate = () => {
    if (template_id) {
      navigate(`${linkPrefix}resources/create`, {
        state: { template_id: template_id },
      });
    }
  };

  return (
    <EntityProvider entity_name="template" entity_id={template_id || ""}>
      <EntityContainer
        title={"Template Overview"}
        actions={
          <Button variant="outlined" onClick={handleUseTemplate}>
            Use This Template
          </Button>
        }
      >
        <TemplateContent />
      </EntityContainer>
    </EntityProvider>
  );
};

TemplatePage.path = "/templates/:template_id";
