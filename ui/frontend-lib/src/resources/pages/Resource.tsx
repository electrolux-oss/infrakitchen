import { useNavigate, useParams } from "react-router";

import { Button } from "@mui/material";

import { LogLiveTail, PermissionWrapper, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { ResourceContent } from "../components/ResourceContent";
import { ResourceReviewView } from "../components/ResourceReviewView";

export const ResourcePage = () => {
  const { resource_id } = useParams();

  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const handleMetadata = () => {
    if (resource_id) {
      navigate(`${linkPrefix}resources/${resource_id}/metadata`);
    }
  };
  return (
    <EntityProvider entity_name="resource" entity_id={resource_id || ""}>
      <EntityContainer
        title={"Resource Overview"}
        actions={
          <PermissionWrapper
            requiredPermission="api:resource"
            permissionAction="write"
          >
            <Button variant="outlined" onClick={handleMetadata}>
              Metadata
            </Button>
          </PermissionWrapper>
        }
      >
        <ResourceReviewView />
        <ResourceContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

ResourcePage.path = "/resources/:resource_id";
