import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { WorkspaceResponse } from "../types";

export interface TemplateConfigurationProps {
  workspace: WorkspaceResponse;
}

export const WorkspaceConfiguration = ({
  workspace,
}: TemplateConfigurationProps) => {
  return (
    <PropertyCollapseCard
      title={"Workspace Configuration"}
      expanded={true}
      id="workspace-config"
    >
      <OverviewCard>
        <CommonField
          name={"Integration"}
          value={
            <GetReferenceUrlValue
              {...workspace.integration}
              urlProvider={workspace.integration.integration_provider}
            />
          }
        />
        <CommonField
          name={"Workspace Provider"}
          value={getProviderValue(workspace.workspace_provider)}
        />
        {Object.entries(workspace.configuration).map(([k, v]) => {
          return (
            <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />
          );
        })}
      </OverviewCard>
    </PropertyCollapseCard>
  );
};
