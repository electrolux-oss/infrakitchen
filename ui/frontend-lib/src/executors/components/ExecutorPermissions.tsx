import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { ExecutorResponse } from "../types";

interface AdvancedSettingsProps {
  executor: ExecutorResponse;
}

export const ExecutorPermissions = ({ executor }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesTab
      entity_id={executor.id}
      entity_name={executor._entity_name}
    />
  );
};
