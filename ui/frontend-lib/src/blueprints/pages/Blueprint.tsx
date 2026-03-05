import { useNavigate, useParams } from "react-router";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Button } from "@mui/material";

import { EntityContainer } from "../../common/components/EntityContainer";
import { useConfig } from "../../common/context/ConfigContext";
import { EntityProvider } from "../../common/context/EntityContext";
import { BlueprintContent } from "../components/BlueprintContent";

export const BlueprintPage = () => {
  const { blueprint_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  return (
    <EntityProvider entity_name="blueprint" entity_id={blueprint_id || ""}>
      <EntityContainer
        title="Blueprint Overview"
        showActivity={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={() =>
              navigate(`${linkPrefix}blueprints/${blueprint_id}/use`)
            }
          >
            Use Blueprint
          </Button>
        }
      >
        <BlueprintContent />
      </EntityContainer>
    </EntityProvider>
  );
};

BlueprintPage.path = "/blueprints/:blueprint_id";
