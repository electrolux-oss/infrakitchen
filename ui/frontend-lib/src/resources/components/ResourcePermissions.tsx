import { EntityPoliciesCard } from "../../permissions/components/policies/EntityPoliciesCard";
import { ResourceResponse } from "../types";

export interface AdvancedSettingsProps {
  resource: ResourceResponse;
}

export const ResourcePermissions = ({ resource }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesCard
      entity_id={resource.id}
      entity_name={resource._entity_name}
    />
  );
};
