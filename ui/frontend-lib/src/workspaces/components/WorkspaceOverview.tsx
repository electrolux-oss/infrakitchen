import { getLabels, CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { WorkspaceResponse } from "../types";

export interface WorkspaceAboutProps {
  workspace: WorkspaceResponse;
}

export const WorkspaceOverview = ({ workspace }: WorkspaceAboutProps) => {
  return (
    <OverviewCard name={workspace.name} description={workspace.description}>
      <CommonField
        name={"State"}
        value={<StatusChip status={workspace.status} />}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={workspace.created_at} user={workspace.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={workspace.updated_at} />}
      />
      <CommonField
        name={"Labels"}
        value={getLabels(workspace.labels)}
        size={12}
      />
    </OverviewCard>
  );
};
