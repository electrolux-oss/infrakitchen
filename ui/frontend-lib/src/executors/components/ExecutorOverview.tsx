import {
  getLabels,
  CommonField,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { ExecutorResponse } from "../types";

export interface ExecutorAboutProps {
  executor: ExecutorResponse;
}

export const ExecutorOverview = ({ executor }: ExecutorAboutProps) => {
  return (
    <OverviewCard
      name={executor.name}
      description={executor.description}
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
      {executor.source_code && (
        <CommonField
          name={"Source Code"}
          value={<GetReferenceUrlValue {...executor.source_code} />}
        />
      )}
      <CommonField
        name={"Source Code Directory"}
        value={getTextValue(
          executor.source_code_folder
            ? executor.source_code_folder
            : "No Source Code Folder",
        )}
      />
      <CommonField
        name={"Branch"}
        value={getTextValue(
          executor.source_code_branch
            ? executor.source_code_branch
            : "No Branch",
        )}
      />
      <CommonField
        name={"Source Code Tag"}
        value={getTextValue(
          executor.source_code_version
            ? executor.source_code_version
            : "No Tag",
        )}
      />

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
        value={getLabels(executor.labels)}
        size={12}
      />
    </OverviewCard>
  );
};
