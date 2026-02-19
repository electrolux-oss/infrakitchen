import { Box } from "@mui/material";

import { IconField } from "../../common";
import {
  CommonField,
  GetReferenceUrlValue,
  getLabels,
  getRemoteUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { getRepoNameFromUrl } from "../../common/utils";
import { SourceCodeResponse } from "../types";

export interface SourceCodeOverviewProps {
  sourceCode: SourceCodeResponse;
}

export const SourceCodeOverview = ({ sourceCode }: SourceCodeOverviewProps) => {
  return (
    <OverviewCard
      name={getRepoNameFromUrl(sourceCode.source_code_url)}
      description={sourceCode.description}
    >
      <CommonField
        name={"URL"}
        value={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {IconField(sourceCode.source_code_provider)}
            {getRemoteUrlValue(sourceCode.source_code_url)}
          </Box>
        }
      />
      <CommonField
        name={"Type"}
        value={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {IconField(sourceCode.source_code_language)}
            {sourceCode.source_code_language}
          </Box>
        }
      />
      <CommonField
        name={"Status"}
        value={
          <StatusChip
            status={sourceCode.status}
            updatedAt={sourceCode.updated_at}
          />
        }
      />
      <CommonField
        name={"Integration"}
        value={
          sourceCode.integration ? (
            <GetReferenceUrlValue
              {...sourceCode.integration}
              urlProvider={sourceCode.integration.integration_provider}
            />
          ) : (
            "N/A"
          )
        }
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={sourceCode.created_at}
            user={sourceCode.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={sourceCode.updated_at} />}
      />
      <CommonField name={"Labels"} value={getLabels(sourceCode.labels)} />
    </OverviewCard>
  );
};
