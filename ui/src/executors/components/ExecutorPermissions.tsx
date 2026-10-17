import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { GqlExecutor } from "../graphql";

export interface AdvancedSettingsProps {
  executor: GqlExecutor;
}

export const ExecutorPermissions = ({ executor }: AdvancedSettingsProps) => {
  return (
    <EntityPoliciesTab
      entityId={executor.id}
      entityName={executor.entityName}
    />
  );
};
