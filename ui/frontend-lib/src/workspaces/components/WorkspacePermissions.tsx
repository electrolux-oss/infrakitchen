import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { GqlWorkspace } from "../graphql";

export interface WorkspacePermissionsProps {
  workspace: GqlWorkspace;
}

export const WorkspacePermissions = ({
  workspace,
}: WorkspacePermissionsProps) => {
  return (
    <EntityPoliciesTab
      entityId={workspace.id}
      entityName={workspace.entityName}
    />
  );
};
