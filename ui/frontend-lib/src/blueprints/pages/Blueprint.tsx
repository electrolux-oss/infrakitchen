import { useNavigate, useParams } from "react-router";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Button } from "@mui/material";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { useConfig } from "../../common/context/ConfigContext";
import { EntityProvider } from "../../common/context/EntityContext";
import { BlueprintContent } from "../components/BlueprintContent";
import { BLUEPRINT_FIELDS } from "../graphql";

export const BlueprintPage = () => {
  const { blueprint_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  return (
    <EntityProvider
      entity_name="blueprint"
      entity_id={blueprint_id || ""}
      entityFields={BLUEPRINT_FIELDS}
    >
      <EntityContainer
        actions={
          <>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() =>
                navigate(`${linkPrefix}blueprints/${blueprint_id}/use`)
              }
            >
              Use Blueprint
            </Button>
            <EntityRefreshButton />
          </>
        }
      >
        <BlueprintContent />
      </EntityContainer>
    </EntityProvider>
  );
};

BlueprintPage.path = "/blueprints/:blueprint_id/:tab?";
