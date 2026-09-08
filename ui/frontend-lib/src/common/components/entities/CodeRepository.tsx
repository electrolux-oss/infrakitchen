import { Stack } from "@mui/material";

import { ProviderIcon } from "../../../icons/Icons";
import { EntityLink } from "./EntityLink";
import { getRepoNameFromUrl } from "../../utils";

export interface CodeRepositoryProps {
  id?: string;
  entityName?: string;
  /** Overrides the repo name derived from ``sourceCodeUrl``. */
  name?: string;
  sourceCodeUrl?: string;
  sourceCodeProvider?: string;
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
      {id && entityName ? (
        <EntityLink id={id} entityName={entityName} name={repoName} noWrap />
      ) : (
        <span>{repoName}</span>
      )}
    </Stack>
  );
};
