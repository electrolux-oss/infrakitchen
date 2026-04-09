import { OverviewCard } from "../../common/components/OverviewCard";
import { AzureDevopsPullRequestsList } from "../../providers/azure_devops/AzureDevopsPullRequestsList";
import { BitbucketPullRequestsList } from "../../providers/bitbucket/PullRequestsList";
import { GithubPullRequestsList } from "../../providers/github/GithubPullRequestsList";
import { WorkspaceResponse } from "../types";

interface WorkspacePullRequestsProps {
  workspace: WorkspaceResponse;
}

export const WorkspacePullRequests = ({
  workspace,
}: WorkspacePullRequestsProps) => {
  const provider = workspace.workspace_provider;
  const queryParams = { integration_id: workspace.integration.id };
  const organization = workspace.configuration.organization;
  const name = workspace.name;

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
