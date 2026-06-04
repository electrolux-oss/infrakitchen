import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { WorkspaceContent } from "../components/WorkspaceContent";
import { WORKSPACE_DETAIL_FIELDS, transformWorkspace } from "../graphql";

export const WorkspacePage = () => {
  const { workspace_id } = useParams();

  return (
    <EntityProvider
      entity_name="workspace"
      entity_id={workspace_id || ""}
      transformFn={transformWorkspace}
      entityFields={WORKSPACE_DETAIL_FIELDS}
    >
      <EntityContainer title={"Workspace Overview"}>
        <WorkspaceContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkspacePage.path = "/workspaces/:workspace_id/:tab?";
