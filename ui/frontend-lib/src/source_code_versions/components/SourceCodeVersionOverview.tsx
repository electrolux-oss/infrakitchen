import {
  getLabels,
  CommonField,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { SourceCodeVersionResponse } from "../types";

export interface SourceCodeVersionAboutProps {
  source_code_version: SourceCodeVersionResponse;
}

export const SourceCodeVersionOverview = ({
  source_code_version,
}: SourceCodeVersionAboutProps) => {
  return (
    <OverviewCard
      name={source_code_version.identifier}
      description={source_code_version.description || "No description"}
    >
      <CommonField
        name={"Template"}
        value={<GetReferenceUrlValue {...source_code_version.template} />}
      />
      <CommonField
        name={"State"}
        value={
          <StatusChip
            status={source_code_version.status}
            state={source_code_version.state}
          />
        }
      />
      <CommonField
        name={"Source Code"}
        value={<GetReferenceUrlValue {...source_code_version.source_code} />}
      />
      <CommonField
        name={"Source Code Directory"}
        value={getTextValue(
          source_code_version.source_code_folder
            ? source_code_version.source_code_folder
            : "No Source Code Folder",
        )}
      />
      <CommonField
        name={"Branch"}
        value={getTextValue(
          source_code_version.source_code_branch
            ? source_code_version.source_code_branch
            : "No Branch",
        )}
      />
      <CommonField
        name={"Source Code Tag"}
        value={getTextValue(
          source_code_version.source_code_version
            ? source_code_version.source_code_version
            : "No Version",
        )}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={source_code_version.created_at}
            user={source_code_version.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={source_code_version.updated_at} />}
      />
      <CommonField
        name={"Labels"}
        value={getLabels(source_code_version.labels)}
        size={12}
      />
    </OverviewCard>
  );
};
