import { Entity, formatLabel } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { GqlWorkspace } from "../graphql";

export interface WorkspaceConfigurationProps {
  workspace: GqlWorkspace;
}

export const WorkspaceConfiguration = ({
  workspace,
}: WorkspaceConfigurationProps) => {
  return (
    <BaseCard name="Workspace Configuration">
      {workspace.integration && (
        <CommonField
          name={"Integration"}
          value={
            <Entity entity={workspace.integration} providerIconSize={18} />
          }
        />
      )}
      <CommonField
        name={"Workspace Provider"}
        value={getProviderValue(workspace.workspaceProvider, 18)}
      />
      {Object.entries(workspace.configuration || []).map(([k, v]) => {
        return <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />;
      })}
    </BaseCard>
  );
};
