import { useCallback } from "react";

import { useNavigate, useParams } from "react-router";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Button } from "@mui/material";

import { EntityContainer } from "../../common/components/EntityContainer";
import { useConfig } from "../../common/context/ConfigContext";
import { EntityProvider } from "../../common/context/EntityContext";
import { getGraphQLClient, initGraphQLClient } from "../../graphql/client";
import { BlueprintContent } from "../components/BlueprintContent";
import { BLUEPRINT_QUERY, GqlBlueprint, transformBlueprint } from "../graphql";

export const BlueprintPage = () => {
  const { blueprint_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix, ikApi } = useConfig();

  const fetchBlueprint = useCallback(
    async (_name: string, id: string) => {
      try {
        getGraphQLClient();
      } catch {
        initGraphQLClient(ikApi);
      }
      const client = getGraphQLClient();
      const { blueprint } = await client.request<{
        blueprint: GqlBlueprint | null;
      }>(BLUEPRINT_QUERY, { id });
      if (!blueprint) throw new Error("Blueprint not found");
      return transformBlueprint(blueprint);
    },
    [ikApi],
  );

  return (
    <EntityProvider
      entity_name="blueprint"
      entity_id={blueprint_id || ""}
      fetchFn={fetchBlueprint}
    >
      <EntityContainer
        title="Blueprint Overview"
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

BlueprintPage.path = "/blueprints/:blueprint_id/:tab?";
