import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { ExecutorResponse } from "../types";

interface ExecutorAboutProps {
  executor: ExecutorResponse;
}

export const ExecutorOverview = ({ executor }: ExecutorAboutProps) => {
  return (
    <OverviewCard
      name={executor.name}
      description={executor.description || "No description"}
      actions={
        <FavoriteButton
          componentId={String(executor.id)}
          componentType="executor"
          ariaLabel="Add executor to favorites"
        />
      }
    >
      <CommonField
        name={"State"}
        value={<StatusChip status={executor.status} state={executor.state} />}
      />
      <CommonField
        name={"Code Repository"}
        value={
          executor.source_code ? (
            <GetReferenceUrlValue {...executor.source_code} />
          ) : null
        }
      />
      <CommonField
        name={"Directory Path"}
        value={executor.source_code_folder}
      />
      <CommonField name={"Branch"} value={executor.source_code_branch} />
      <CommonField name={"Git Tag"} value={executor.source_code_version} />

      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={executor.created_at} user={executor.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={executor.updated_at} />}
      />
      <CommonField
        name={"Labels"}
        value={<Labels labels={executor.labels} />}
        size={12}
      />
    </OverviewCard>
  );
};
