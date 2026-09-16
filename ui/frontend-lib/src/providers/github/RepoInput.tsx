import { useState, forwardRef } from "react";

import { Box, TextField, Button } from "@mui/material";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { notify, notifyError } from "../../common/hooks/useNotification";

import { GITHUB_REPO_QUERY } from "./graphql";
import { GithubRepo } from "./types";

interface GithubRepoInputProps {
  ikApi: InfraKitchenApi;
  onChange: (repo: GithubRepo | null) => void;
  value: GithubRepo | null;
  label: string;
  error?: boolean;
  helpertext?: string;
  queryParams?: Record<string, any>;
  [key: string]: any;
}

const GITHUB_URL_PATTERN =
  /^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

const parseGithubUrl = (url: string): { org: string; repo: string } | null => {
  const match = url.trim().match(GITHUB_URL_PATTERN);
  if (!match) return null;
  const [, org, repo] = match;
  return { org, repo };
};

const GithubRepoInput = forwardRef<any, GithubRepoInputProps>((props, _ref) => {
  const {
    ikApi,
    onChange,
    value,
    queryParams,
    error,
    helpertext,
    ...otherProps
  } = props;
  const [urlDraft, setUrlDraft] = useState(value?.html_url ?? "");
  const [validatedUrl, setValidatedUrl] = useState(value?.html_url ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const isValidated = !!value && urlDraft.trim() === validatedUrl;

  const handleDraftChange = (newValue: string) => {
    setUrlDraft(newValue);
    if (value) onChange(null);
    setValidatedUrl(null);
    setHasFailed(false);
  };

  const validateUrl = async () => {
    const trimmed = urlDraft.trim();
    if (!trimmed || trimmed === validatedUrl) return;

    const parsed = parseGithubUrl(trimmed);
    if (!parsed) {
      setHasFailed(true);
      onChange(null);
      notifyError(
        new Error(
          "Invalid GitHub repository URL. Expected format: https://github.com/org/repo",
        ),
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = (await ikApi.graphqlRequest(GITHUB_REPO_QUERY, {
        integrationId: queryParams?.integration_id,
        org: parsed.org,
        repo: parsed.repo,
      })) as { githubRepo: GithubRepo };

      if (response.githubRepo.archived) {
        setHasFailed(true);
        onChange(null);
        notifyError(
          new Error(
            `${response.githubRepo.full_name} is archived and read-only. Archived repositories cannot accept pull requests.`,
          ),
        );
        return;
      }

      if (!response.githubRepo.permissions?.push) {
        setHasFailed(true);
        onChange(null);
        notifyError(
          new Error(
            `The integration does not have write access to ${response.githubRepo.full_name}. Write access is required to create pull requests.`,
          ),
        );
        return;
      }

      onChange(response.githubRepo);
      setValidatedUrl(trimmed);
      setHasFailed(false);
      notify(`Verified ${response.githubRepo.full_name}`, "success");
    } catch (err: any) {
      setHasFailed(true);
      onChange(null);
      notifyError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <TextField
        value={urlDraft}
        onChange={(e) => handleDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            validateUrl();
          }
        }}
        variant="outlined"
        error={hasFailed || error}
        helperText={
          helpertext ||
          "The URL of the repository, e.g., https://github.com/org/repo"
        }
        fullWidth
        margin="normal"
        disabled={isLoading}
        {...otherProps}
      />
      <Button
        variant="outlined"
        size="small"
        onClick={validateUrl}
        disabled={isLoading || !urlDraft.trim() || isValidated}
      >
        {isLoading ? "Validating..." : "Validate"}
      </Button>
    </Box>
  );
});

GithubRepoInput.displayName = "GithubRepoInput";
export default GithubRepoInput;
