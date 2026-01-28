import { EntityPoliciesCard } from "../../permissions/components/policies/EntityPoliciesCard";
import { ExecutorResponse } from "../types";

export interface AdvancedSettingsProps {
  executor: ExecutorResponse;
}

export const ExecutorPermissions = ({ executor }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesCard
      entity_id={executor.id}
      entity_name={executor._entity_name}
    />
  );
};
