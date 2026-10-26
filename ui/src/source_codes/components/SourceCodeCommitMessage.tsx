import { useState } from "react";

import { MarkdownViewer } from "../../common/components/viewers/MarkdownViewer";
import { HeroInformationCircleIcon } from "../../icons";
import { Popover } from "../../ui";
import { GqlSourceCodeCommit } from "../graphql";

interface SourceCodeCommitMessageProps {
  commit: GqlSourceCodeCommit;
}

export const SourceCodeCommitMessage = ({
  commit,
}: SourceCodeCommitMessageProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const details = commit.description.trim();

  return (
    <span className="[word-break:break-word]">
      <span>{commit.message}</span>
      {details && (
        <>
          {" "}
          <span
            className="mx-0.5 inline-flex cursor-pointer items-center [vertical-align:-2px]"
            role="button"
            tabIndex={0}
            aria-label="Commit description"
            onClick={(e) => {
              e.stopPropagation();
              setAnchorEl(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                setAnchorEl(e.currentTarget);
              }
            }}
          >
            <HeroInformationCircleIcon
              className="block text-[15px] text-action-active"
              fontSize="small"
            />
          </span>
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 max-h-[320px] max-w-[420px] overflow-auto"
          >
            <MarkdownViewer
              content={details}
              disableInlineCodeCopy
              className="p-3 text-fg-muted"
            />
          </Popover>
        </>
      )}
    </span>
  );
};
