import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { ResourceResponse } from "../types";

export interface AdvancedSettingsProps {
  resource: ResourceResponse;
}

export const ResourcePermissions = ({ resource }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesTab
      entityId={resource.id}
      entityName={resource._entity_name}
    />
  );
};
