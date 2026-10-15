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
    <div className="flex min-w-0 flex-row items-center gap-2 overflow-hidden">
      <ProviderIcon provider={sourceCodeProvider} />
      {id && entityName && !disableLink ? (
        <EntityLink id={id} entityName={entityName} name={repoName} noWrap />
      ) : (
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {repoName}
        </span>
      )}
    </div>
  );
};
