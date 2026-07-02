import { OverviewCard } from "../../common/components/OverviewCard";
import { AzureDevopsPullRequestsList } from "../../providers/azure_devops/AzureDevopsPullRequestsList";
import { BitbucketPullRequestsList } from "../../providers/bitbucket/PullRequestsList";
import { GithubPullRequestsList } from "../../providers/github/GithubPullRequestsList";
import { GqlWorkspace } from "../graphql";

interface WorkspacePullRequestsProps {
  workspace: GqlWorkspace;
}

export const WorkspacePullRequests = ({
  workspace,
}: WorkspacePullRequestsProps) => {
  const provider = workspace.workspaceProvider;
  const organization = workspace.configuration?.organization;
  const name = workspace.name;

  if (!provider || !organization || !name || !workspace.integration?.id) {
    return (
      <OverviewCard name="Pull Requests">
        <p>Missing required information to display pull requests.</p>
      </OverviewCard>
    );
  }
  const queryParams = { integration_id: workspace.integration.id };

  return (
    <OverviewCard name="Pull Requests">
      {provider === "github" && (
        <GithubPullRequestsList
          organization={organization}
          repoName={name}
          queryParams={queryParams}
        />
      )}
      {provider === "bitbucket" && (
        <BitbucketPullRequestsList
          organization={organization}
          repoName={name}
          queryParams={queryParams}
        />
      )}
      {provider === "azure_devops" && (
        <AzureDevopsPullRequestsList
          organization={organization}
          repoName={name}
          queryParams={queryParams}
        />
      )}
    </OverviewCard>
  );
};
