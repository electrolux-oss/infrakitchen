import { getLabels, CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { IntegrationResponse } from "../types";

export interface IntegrationAboutProps {
  integration: IntegrationResponse;
}

export const IntegrationOverview = ({ integration }: IntegrationAboutProps) => {
  return (
    <OverviewCard name={integration.name} description={integration.description}>
      <CommonField
        name={"Status"}
        value={<StatusChip status={integration.status} />}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={integration.created_at}
            user={integration.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={integration.updated_at} />}
      />
      <CommonField
        name={"Labels"}
        value={getLabels(integration.labels)}
        size={12}
      />
    </OverviewCard>
  );
};
