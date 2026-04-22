import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { ResourceResponse } from "../types";

interface AdvancedSettingsProps {
  resource: ResourceResponse;
}

export const ResourcePermissions = ({ resource }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesTab
      entity_id={resource.id}
      entity_name={resource._entity_name}
    />
  );
};
