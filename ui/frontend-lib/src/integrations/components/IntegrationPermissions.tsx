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
      entity_id={integration.id}
      entity_name={integration._entity_name}
    />
  );
};
