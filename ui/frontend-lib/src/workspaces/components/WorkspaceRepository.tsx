import { AzureDevopsRepoMetadata } from "../../providers/azure_devops/RepoMetadata";
import { BitbucketRepoMetadata } from "../../providers/bitbucket/RepoMetadata";
import { GithubRepoMetadata } from "../../providers/github/RepoMetadata";
import { WorkspaceResponse } from "../types";

interface WorkspaceRepositoryProps {
  workspace: WorkspaceResponse;
}

export const WorkspaceRepository = ({
  workspace,
}: WorkspaceRepositoryProps) => {
  const provider = workspace.workspace_provider;
  const queryParams = { integration_id: workspace.integration.id };
  const organization = workspace.configuration.organization;
  const name = workspace.name;

  return (
    <>
      {provider === "github" && (
        <GithubRepoMetadata
          organization={organization}
          name={name}
          queryParams={queryParams}
        />
      )}
      {provider === "bitbucket" && (
        <BitbucketRepoMetadata
          organization={organization}
          name={name}
          queryParams={queryParams}
        />
      )}
      {provider === "azure_devops" && (
        <AzureDevopsRepoMetadata
          organization={organization}
          name={name}
          queryParams={queryParams}
        />
      )}
    </>
  );
};
