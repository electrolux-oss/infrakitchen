import { getLabels, CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { SecretResponse } from "../types";

export interface SecretAboutProps {
  secret: SecretResponse;
}

export const SecretOverview = ({ secret }: SecretAboutProps) => {
  return (
    <OverviewCard name={secret.name} description={secret.description}>
      <CommonField
        name={"State"}
        value={<StatusChip status={secret.status} state={secret.state} />}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={secret.created_at} user={secret.creator} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={secret.updated_at} />}
      />
      <CommonField
        name={"Secret Tags"}
        value={getLabels(secret.labels)}
        size={12}
      />
    </OverviewCard>
  );
};
