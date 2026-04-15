import { useParams, useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button, Tooltip } from "@mui/material";

import { useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { ENTITY_STATUS } from "../../utils/constants";
import { TemplateContent } from "../components/TemplateContent";

export const TemplatePage = () => {
  const { template_id } = useParams();

  return (
    <EntityProvider entity_name="template" entity_id={template_id || ""}>
      <TemplatePageContent />
    </EntityProvider>
  );
};

const TemplatePageContent = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const { entity } = useEntityProvider();

  const handleUseTemplate = () => {
    if (entity?.id) {
      navigate(`${linkPrefix}resources/create`, {
        state: { template_id: entity.id },
      });
    }
  };

  return (
    <EntityContainer
      title={"Template Overview"}
      actions={
        entity?.status !== ENTITY_STATUS.DISABLED ? (
          <Tooltip title="Create a new resource from this template">
            <Button
              variant="outlined"
              onClick={handleUseTemplate}
              startIcon={<AddIcon />}
            >
              Create Resource
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      <TemplateContent />
    </EntityContainer>
  );
};

TemplatePage.path = "/templates/:template_id/:tab?";
