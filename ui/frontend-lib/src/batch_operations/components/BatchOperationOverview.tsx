import { CommonField } from "../../common/components/fields/CommonField";
import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
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
        value={<RelativeTime date={batchOperation.createdAt} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={batchOperation.updatedAt} />}
      />
    </OverviewCard>
  );
};
