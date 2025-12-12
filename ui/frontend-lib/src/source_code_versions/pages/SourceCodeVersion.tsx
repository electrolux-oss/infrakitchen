import { useNavigate, useParams } from "react-router";

import { Button } from "@mui/material";

import { LogLiveTail, PermissionWrapper, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { SourceCodeVersionContent } from "../components/SourceCodeVersionContent";

export const SourceCodeVersionPage = () => {
  const { source_code_version_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();
  const handleConfig = () => {
    if (source_code_version_id) {
      navigate(
        `${linkPrefix}source_code_versions/${source_code_version_id}/configs`,
      );
    }
  };

  return (
    <EntityProvider
      entity_name="source_code_version"
      entity_id={source_code_version_id || ""}
    >
      <EntityContainer
        title={"Code Version Overview"}
        actions={
          <PermissionWrapper
            requiredPermission="api:source_code_version"
            permissionAction="write"
          >
            <Button variant="outlined" onClick={handleConfig}>
              Manage Configurations
            </Button>
          </PermissionWrapper>
        }
      >
        <SourceCodeVersionContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

SourceCodeVersionPage.path = "/source_code_versions/:source_code_version_id";
