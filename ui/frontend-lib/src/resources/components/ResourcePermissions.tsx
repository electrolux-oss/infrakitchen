import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { EntityPoliciesCard } from "../../permissions/components/PolicyCard";
import { ResourceResponse } from "../types";

export interface AdvancedSettingsProps {
  resource: ResourceResponse;
}

export const ResourcePermissions = ({ resource }: AdvancedSettingsProps) => {
  return (
    <PropertyCollapseCard title="Permissions" id="resource-permissions">
      <EntityPoliciesCard
        entity_id={resource.id}
        entity_name={resource._entity_name}
      />
    </PropertyCollapseCard>
  );
};
