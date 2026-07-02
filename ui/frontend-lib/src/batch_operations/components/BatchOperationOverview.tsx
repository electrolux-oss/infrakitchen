import { CommonField } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { GqlBatchOperation } from "../graphql";

interface BatchOperationOverviewProps {
  batchOperation: GqlBatchOperation;
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
        value={
          batchOperation.entityType === "resource" ? "Resources" : "Executors"
        }
      />
      <CommonField
        name={"Total Entities"}
        value={batchOperation?.entityIds?.length || 0}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={batchOperation.createdAt}
            user={batchOperation.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={batchOperation.updatedAt} />}
      />
    </OverviewCard>
  );
};
