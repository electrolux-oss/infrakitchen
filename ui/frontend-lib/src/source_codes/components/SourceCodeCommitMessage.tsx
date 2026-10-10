import { ReactNode, useState } from "react";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Collapse, IconButton, Tooltip, Typography } from "@mui/material";

import { GqlSourceCodeCommit } from "../graphql";

interface SourceCodeCommitMessageProps {
  commit: GqlSourceCodeCommit;
  adornments?: ReactNode;
}

export const SourceCodeCommitMessage = ({
  commit,
  adornments,
}: SourceCodeCommitMessageProps) => {
  const [expanded, setExpanded] = useState(false);

  const details = commit.description.trim();

  return (
    <Box>
      <Box
        sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}
      >
        <span>{commit.message}</span>
        {details && (
          <Tooltip title={expanded ? "Hide description" : "Show description"}>
            <IconButton
              size="small"
              aria-label={expanded ? "Hide description" : "Show description"}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              sx={{ p: 0.25 }}
            >
              {expanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        )}
        {adornments}
      </Box>
      {details && (
        <Collapse in={expanded} unmountOnExit>
          <Typography
            variant="body2"
            component="pre"
            sx={{
              mt: 1,
              mb: 0,
              color: "text.secondary",
              fontFamily: "inherit",
              whiteSpace: "pre-wrap",
            }}
          >
            {details}
          </Typography>
        </Collapse>
      )}
    </Box>
  );
};
