import { OverviewCard } from "../../common/components/OverviewCard";
import { AzureDevopsRepoMetadata } from "../../providers/azure_devops/RepoMetadata";
import { BitbucketRepoMetadata } from "../../providers/bitbucket/RepoMetadata";
import { GithubRepoMetadata } from "../../providers/github/RepoMetadata";
import { GqlWorkspace } from "../graphql";

interface WorkspaceRepositoryProps {
  workspace: GqlWorkspace;
}

export const WorkspaceRepository = ({
  workspace,
}: WorkspaceRepositoryProps) => {
  const provider = workspace.workspaceProvider;
  const organization = workspace.configuration?.organization;
  const name = workspace.name;

  if (!provider || !organization || !name || !workspace.integration?.id) {
    return (
      <OverviewCard name="Repository Metadata">
        <p>Missing required information to display pull requests.</p>
      </OverviewCard>
    );
  }
  const queryParams = { integration_id: workspace.integration.id };

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
