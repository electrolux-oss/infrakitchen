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
      entity_id={workspace.id}
      entity_name={workspace._entity_name}
    />
  );
};
