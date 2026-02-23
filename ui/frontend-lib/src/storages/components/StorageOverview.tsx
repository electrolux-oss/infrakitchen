import { getLabels, CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { StorageResponse } from "../types";

export interface StorageAboutProps {
  storage: StorageResponse;
}

export const StorageOverview = ({ storage }: StorageAboutProps) => {
  return (
    <OverviewCard name={storage.name} description={storage.description}>
      <CommonField
        name={"State"}
        value={
          <StatusChip
            status={storage.status}
            state={storage.state}
            updatedAt={storage.updated_at}
          />
        }
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
        value={getLabels(storage.labels)}
        size={12}
      />
    </OverviewCard>
  );
};
