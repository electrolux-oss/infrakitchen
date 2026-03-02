import { useCallback } from "react";
import React from "react";

import { useNavigate } from "react-router";

import { Box, Link } from "@mui/material";

import { SourceCodeVersionShort } from "../types";

interface SourceCodeVersionLinkProps {
  source_code_version: SourceCodeVersionShort;
  name?: string | undefined;
}

export const SourceCodeVersionLink = ({
  source_code_version,
  name = undefined,
}: SourceCodeVersionLinkProps) => {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Allow default behavior for Cmd/Ctrl+Click (opens in new tab)
      if (e.metaKey || e.ctrlKey) {
        return;
      }

      e.preventDefault();
      navigate(`/source_codes/${source_code_version.source_code.id}`, {
        state: source_code_version.source_code_version
          ? { refTagSearch: source_code_version.source_code_version }
          : { refBranchSearch: source_code_version.source_code_branch },
      });
    },
    [navigate, source_code_version],
  );

  return (
    <Box>
      <Link
        onClick={handleClick}
        style={{ textDecoration: "none", cursor: "pointer" }}
      >
        {name ?? source_code_version.identifier}
      </Link>
    </Box>
  );
};
