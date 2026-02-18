import gitlab


class GitLabApi:
    client: gitlab.Gitlab

    def __init__(self, environment_variables: dict[str, str]):
        self.client = gitlab.Gitlab(
            url=environment_variables.get("GITLAB_SERVER_URL"), private_token=environment_variables.get("GITLAB_TOKEN")
        )
