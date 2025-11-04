import { useState, SyntheticEvent, useCallback, useEffect } from "react";

import { useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { TabContext, TabList, TabPanel } from "@mui/lab";
import { Alert, Box, Tab, Typography } from "@mui/material";

import { useConfig } from "../../common";
import { AzureDevopsPullRequestsList } from "../../providers/azure_devops/AzureDevopsPullRequestsList";
import { AzureDevopsRepoMetadata } from "../../providers/azure_devops/RepoMetadata";
import { BitbucketPullRequestsList } from "../../providers/bitbucket/PullRequestsList";
import { BitbucketRepoMetadata } from "../../providers/bitbucket/RepoMetadata";
import { GithubPullRequestsList } from "../../providers/github/GithubPullRequestsList";
import { GithubRepoMetadata } from "../../providers/github/RepoMetadata";
import { WorkspaceResponse } from "../types";

export function WorkspaceMetadataPage() {
  const { ikApi } = useConfig();

  const { workspace_id } = useParams();

  const [entity, setEntity] = useState<WorkspaceResponse>();
  const [workspace_provider, setWorkspaceProvider] = useState<string>("");
  const [path, setPath] = useState("repo");
  const [error, setError] = useState<Error>();

  const getWorkspace = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`workspaces/${workspace_id}`)
      .then((response: WorkspaceResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, workspace_id]);

  useEffectOnce(() => {
    getWorkspace();
  });

  useEffect(() => {
    if (entity) {
      setWorkspaceProvider(entity.workspace_provider);
    }
  }, [entity]);

  const handleChange = (_event: SyntheticEvent, newValue: string) => {
    setPath(newValue);
  };
  const implemented_workspace_providers = [
    "github",
    "bitbucket",
    "azure_devops",
  ];

  if (!entity) return null;

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {implemented_workspace_providers.includes(workspace_provider) ? (
        <TabContext value={path}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <TabList onChange={handleChange} aria-label="lab API tabs example">
              <Tab
                value={"repo"}
                label={"Repository"}
                key={"repo"}
                id="tab-repo"
                aria-controls="tabpanel-repo"
              />
              <Tab
                value={"pulls"}
                label={"Pull Requests"}
                key={"pulls"}
                id="tab-pulls"
                aria-controls="tabpanel-pulls"
              />
            </TabList>
          </Box>
          <TabPanel value="repo" id="tabpanel-repo" aria-labelledby="tab-repo">
            {workspace_provider === "github" && (
              <GithubRepoMetadata
                organization={entity.configuration.organization}
                name={entity.name}
                queryParams={{ integration_id: entity.integration.id }}
              />
            )}
            {workspace_provider === "bitbucket" && (
              <BitbucketRepoMetadata
                organization={entity.configuration.organization}
                name={entity.name}
                queryParams={{ integration_id: entity.integration.id }}
              />
            )}
            {workspace_provider === "azure_devops" && (
              <AzureDevopsRepoMetadata
                organization={entity.configuration.organization}
                name={entity.name}
                queryParams={{ integration_id: entity.integration.id }}
              />
            )}
          </TabPanel>
          <TabPanel
            value="pulls"
            id="tabpanel-pulls"
            aria-labelledby="tab-pulls"
          >
            {workspace_provider === "github" && (
              <GithubPullRequestsList
                organization={entity.configuration.organization}
                repoName={entity.name}
                queryParams={{ integration_id: entity.integration.id }}
              />
            )}
            {workspace_provider === "bitbucket" && (
              <BitbucketPullRequestsList
                organization={entity.configuration.organization}
                repoName={entity.name}
                queryParams={{ integration_id: entity.integration.id }}
              />
            )}
            {workspace_provider === "azure_devops" && (
              <AzureDevopsPullRequestsList
                organization={entity.configuration.organization}
                repoName={entity.name}
                queryParams={{ integration_id: entity.integration.id }}
              />
            )}
          </TabPanel>
        </TabContext>
      ) : (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1">
            {`Workspace provider ${workspace_provider} is not implemented.`}
          </Typography>
        </Box>
      )}
    </>
  );
}

WorkspaceMetadataPage.path = "/workspaces/:workspace_id/metadata";
