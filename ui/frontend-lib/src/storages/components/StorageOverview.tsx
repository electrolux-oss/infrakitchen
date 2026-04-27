import { CommonField } from "../../common/components/CommonField";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { StorageResponse } from "../types";

interface StorageAboutProps {
  storage: StorageResponse;
}

export const StorageOverview = ({ storage }: StorageAboutProps) => {
  return (
    <OverviewCard name={storage.name} description={storage.description}>
      <CommonField
        name={"State"}
        value={<StatusChip status={storage.status} state={storage.state} />}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={storage.created_at} user={storage.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={storage.updated_at} />}
      />
      <CommonField
        name={"Storage Tags"}
        value={<Labels labels={storage.labels} />}
        size={12}
      />
    </OverviewCard>
  );
};
