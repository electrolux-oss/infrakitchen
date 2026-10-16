import { Box, Stack } from "@mui/material";

import { ProviderIcon } from "../../../icons/Icons";
import { getRepoNameFromUrl } from "../../utils";

import { EntityLink } from "./EntityLink";

export interface CodeRepositoryProps {
  id?: string;
  entityName?: string;
  /** Overrides the repo name derived from ``sourceCodeUrl``. */
  name?: string;
  sourceCodeUrl?: string;
  sourceCodeProvider?: string;
  disableLink?: boolean;
}

/**
 * Renders a code repository the way the Code Repositories datagrid does:
 * provider icon + short "owner/repo" link. Shared so any surface that shows a
 * repo (the SourceCodes page today, Entity cells later) renders it identically.
 */
export const CodeRepository = ({
  id,
  entityName,
  name,
  sourceCodeUrl,
  sourceCodeProvider,
  disableLink = false,
}: CodeRepositoryProps) => {
  const repoName = name ?? getRepoNameFromUrl(sourceCodeUrl || "");

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <ProviderIcon provider={sourceCodeProvider} />
      {id && entityName && !disableLink ? (
        <EntityLink id={id} entityName={entityName} name={repoName} noWrap />
      ) : (
        <Box
          component="span"
          sx={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {repoName}
        </Box>
      )}
    </Stack>
  );
};
