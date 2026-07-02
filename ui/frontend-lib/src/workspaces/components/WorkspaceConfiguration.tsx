import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { GqlWorkspace } from "../graphql";

export interface WorkspaceConfigurationProps {
  workspace: GqlWorkspace;
}

export const WorkspaceConfiguration = ({
  workspace,
}: WorkspaceConfigurationProps) => {
  return (
    <OverviewCard name="Workspace Configuration">
      {workspace.integration && (
        <CommonField
          name={"Integration"}
          value={
            <GetReferenceUrlValue
              {...workspace.integration}
              urlProvider={workspace.integration.integrationProvider}
            />
          }
        />
      )}
      <CommonField
        name={"Workspace Provider"}
        value={getProviderValue(workspace.workspaceProvider)}
      />
      {Object.entries(workspace.configuration || []).map(([k, v]) => {
        return <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />;
      })}
    </OverviewCard>
  );
};
