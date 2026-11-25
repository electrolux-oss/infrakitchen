const SSH_URL_RE = /^(ssh:\/\/|[^@\s/]+@[^:\s]+:)/;

export const gitIntegrationHint = (
  repositoryUrl: string | null | undefined,
) => {
  const url = repositoryUrl?.trim() ?? "";
  if (!url) return "Credentials to clone the repository, needed with a URL";
  if (SSH_URL_RE.test(url))
    return "SSH URLs need an integration with an SSH key";
  return "HTTPS URLs need a token integration, or Git Public for public repositories";
};
