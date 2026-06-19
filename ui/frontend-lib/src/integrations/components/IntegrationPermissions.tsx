import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { GqlIntegration } from "../graphql";

export interface IntegrationPermissionsProps {
  integration: GqlIntegration;
}

export const IntegrationPermissions = ({
  integration,
}: IntegrationPermissionsProps) => {
  return (
    <EntityPoliciesTab
      entityId={integration.id}
      entityName={integration.entityName}
    />
  );
};
