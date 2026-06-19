import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { GqlResource } from "../graphql";

export interface AdvancedSettingsProps {
  resource: GqlResource;
}

export const ResourcePermissions = ({ resource }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesTab
      entityId={resource.id}
      entityName={resource.entityName}
    />
  );
};
