import CallSplitIcon from "@mui/icons-material/CallSplit";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import { Box } from "@mui/material";

import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { RefFolders, RefType, SourceCodeResponse } from "../types";

import { SourceCodeRefSection } from "./SourceCodeRefSection";

export interface SourceCodeRefOverviewProps {
  sourceCode: SourceCodeResponse;
}

export const SourceCodeRefOverview = ({
  sourceCode,
}: SourceCodeRefOverviewProps) => {
  const getFolders = (ref: string): string[] =>
    sourceCode.git_folders_map.find((r: RefFolders) => r.ref === ref)
      ?.folders ?? [];

  const commonProps = { sourceCodeId: sourceCode.id, getFolders };

  return (
    <PropertyCollapseCard
      id="git-refs-and-versions"
      title="Git Tags & Branches"
      expanded
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <SourceCodeRefSection
          title="Tags"
          icon={SellOutlinedIcon}
          refs={sourceCode.git_tags ?? []}
          type={RefType.TAG}
          {...commonProps}
        />
        <SourceCodeRefSection
          title="Branches"
          icon={CallSplitIcon}
          refs={sourceCode.git_branches ?? []}
          type={RefType.BRANCH}
          {...commonProps}
        />
      </Box>
    </PropertyCollapseCard>
  );
};
