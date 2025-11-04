import { useNavigate, useParams } from "react-router";

import { Button } from "@mui/material";

import { LogLiveTail, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { WorkspaceContent } from "../components/WorkspaceContent";

export const WorkspacePage = () => {
  const { workspace_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const handleMetadata = () => {
    if (workspace_id) {
      navigate(`${linkPrefix}workspaces/${workspace_id}/metadata`);
    }
  };

  return (
    <EntityProvider entity_name="workspace" entity_id={workspace_id || ""}>
      <EntityContainer
        title={"Workspace Overview"}
        actions={
          <Button variant="outlined" onClick={handleMetadata}>
            Metadata
          </Button>
        }
      >
        <WorkspaceContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkspacePage.path = "/workspaces/:workspace_id";
