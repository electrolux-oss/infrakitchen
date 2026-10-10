import re


_SCP_LIKE_URL = re.compile(r"^(?:[^@/]+@)?(?P<host>[^:/]+):(?P<path>[^/].*)$")


def repository_web_url(repository_url: str) -> str | None:
    url = repository_url.strip()
    if url.startswith(("https://", "http://", "ssh://")):
        scheme, rest = url.split("://", 1)
        host_part, _, path = rest.partition("/")
        host = host_part.rsplit("@", 1)[-1].split(":", 1)[0]
        if scheme == "ssh":
            scheme = "https"
    else:
        match = _SCP_LIKE_URL.match(url)
        if not match:
            return None
        host, path, scheme = match["host"], match["path"], "https"

    path = path.removesuffix("/").removesuffix(".git")

    # Azure DevOps SSH: ssh.dev.azure.com:v3/{org}/{project}/{repo}
    if host == "ssh.dev.azure.com" and path.startswith("v3/"):
        parts = path.removeprefix("v3/").split("/")
        if len(parts) != 3:
            return None
        org, project, repo = parts
        return f"https://dev.azure.com/{org}/{project}/_git/{repo}"

    return f"{scheme}://{host}/{path}"


def commit_web_url(repository_url: str, sha: str) -> str | None:
    base = repository_web_url(repository_url)
    if base is None:
        return None
    if "bitbucket" in base:
        return f"{base}/commits/{sha}"
    if "gitlab" in base:
        return f"{base}/-/commit/{sha}"
    return f"{base}/commit/{sha}"
