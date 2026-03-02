import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const WorkspaceActivityPage = () => {
  const { workspace_id } = useParams();

  return (
    <EntityProvider entity_name="workspace" entity_id={workspace_id || ""}>
      <ActivityContainer tabs={["audit"]} />
    </EntityProvider>
  );
};

WorkspaceActivityPage.path = "/workspaces/:workspace_id/activity";
