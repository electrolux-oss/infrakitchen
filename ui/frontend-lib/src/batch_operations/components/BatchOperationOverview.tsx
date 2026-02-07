import { getTextValue, CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { BatchOperation } from "../types";

interface BatchOperationOverviewProps {
  batchOperation: BatchOperation;
}

export const BatchOperationOverview = ({
  batchOperation,
}: BatchOperationOverviewProps) => {
  return (
    <OverviewCard
      name={batchOperation.name}
      description={batchOperation.description}
    >
      <CommonField
        name={"Entity Type"}
        value={getTextValue(
          batchOperation.entity_type === "resource" ? "Resources" : "Executors",
        )}
      />
      <CommonField
        name={"Total Entities"}
        value={getTextValue(String(batchOperation?.entity_ids?.length || 0))}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={batchOperation.created_at}
            user={batchOperation.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={batchOperation.updated_at} />}
      />
    </OverviewCard>
  );
};
