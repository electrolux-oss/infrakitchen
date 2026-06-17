import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { IntegrationResponse } from "../types";

export interface IntegrationPermissionsProps {
  integration: IntegrationResponse;
}

export const IntegrationPermissions = ({
  integration,
}: IntegrationPermissionsProps) => {
  return (
    <EntityPoliciesTab
      entityId={integration.id}
      entityName={integration._entity_name}
    />
  );
};
