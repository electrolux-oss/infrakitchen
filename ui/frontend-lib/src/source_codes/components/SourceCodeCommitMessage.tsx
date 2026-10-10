import { useState } from "react";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Popover } from "@mui/material";

import { MarkdownViewer } from "../../common/components/viewers/MarkdownViewer";
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
    <Box component="span" sx={{ wordBreak: "break-word" }}>
      <span>{commit.message}</span>
      {details && (
        <>
          {" "}
          <Box
            component="span"
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
            sx={{
              display: "inline-flex",
              alignItems: "center",
              verticalAlign: "-2px",
              mx: 0.25,
              cursor: "pointer",
            }}
          >
            <InfoOutlinedIcon
              fontSize="small"
              sx={{ fontSize: 15, color: "action.active", display: "block" }}
            />
          </Box>
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            onClick={(e) => e.stopPropagation()}
            slotProps={{
              paper: {
                sx: {
                  maxWidth: 420,
                  maxHeight: 320,
                  overflow: "auto",
                  mt: 0.5,
                },
              },
            }}
          >
            <MarkdownViewer
              content={details}
              disableInlineCodeCopy
              sx={{ p: 1.5, color: "text.secondary" }}
            />
          </Popover>
        </>
      )}
    </Box>
  );
};
