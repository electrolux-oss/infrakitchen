import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { WorkspaceResponse } from "../types";

export interface WorkspacePermissionsProps {
  workspace: WorkspaceResponse;
}

export const WorkspacePermissions = ({
  workspace,
}: WorkspacePermissionsProps) => {
  return (
    <EntityPoliciesTab
      entityId={workspace.id}
      entityName={workspace._entity_name}
    />
  );
};
