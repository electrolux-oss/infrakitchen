import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { ExecutorResponse } from "../types";

export interface AdvancedSettingsProps {
  executor: ExecutorResponse;
}

export const ExecutorPermissions = ({ executor }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesTab
      entityId={executor.id}
      entityName={executor._entity_name}
    />
  );
};
