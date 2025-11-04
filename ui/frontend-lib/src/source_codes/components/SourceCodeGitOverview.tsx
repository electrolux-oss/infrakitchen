import { Box, Chip, Tooltip } from "@mui/material";

import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { SourceCodeResponse } from "../types";

const ArrayValueSummaryChip = (props: {
  source: string;
  value: any;
  messages?: Record<string, string>;
}) => {
  const { source, value, messages } = props;

  let content;
  if (value.length > 0 && typeof value[0] === "string") {
    content = value.map((v: any, idx: any) => {
      const msg: string = `${v}: ${messages ? messages[v] : ""}`;

      return (
        <Box key={idx} sx={{ display: "inline" }}>
          <Tooltip title={msg} arrow>
            <Chip size="small" sx={{ maxWidth: 150, margin: 0.5 }} label={v} />
          </Tooltip>
        </Box>
      );
    });
  }

  return (
    <PropertyCollapseCard
      title={source}
      expanded={true}
      id={`source-code-git-${source}`}
    >
      <Box
        sx={{
          p: 1,
          display: "flex",
          flexWrap: "wrap",
        }}
      >
        {content}
      </Box>
    </PropertyCollapseCard>
  );
};

export interface SourceCodeGitOverviewProps {
  sourceCode: SourceCodeResponse;
}

export const SourceCodeGitOverview = ({
  sourceCode,
}: SourceCodeGitOverviewProps) => {
  return (
    <PropertyCollapseCard
      title={"Git Metadata"}
      expanded={true}
      id="source-code-git-metadata"
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <ArrayValueSummaryChip
          source="Branches"
          value={sourceCode.git_branches}
          messages={sourceCode.git_branch_messages}
        />
        <ArrayValueSummaryChip
          source="Tags"
          value={sourceCode.git_tags}
          messages={sourceCode.git_tag_messages}
        />
      </Box>
    </PropertyCollapseCard>
  );
};
