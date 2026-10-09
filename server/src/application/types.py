from typing import Literal


type GitProviderType = Literal["github", "gitlab", "bitbucket", "azure_devops", "git_public"]
type CodeLanguageType = Literal["opentofu"]
# module_library: reusable modules used through source code versions, templates and executors;
# iac: modules run per environment by InfraKitchen; application: the code of a service.
type RepositoryType = Literal["module_library", "iac", "application"]
type StorageProviderType = Literal["aws", "azurerm", "gcp", "postgresql"]
type IacToolType = Literal["tofu"]
type IntegrationType = Literal["git", "cloud", "notification"]

type IntegrationProviderType = Literal[
    "aws",
    "azurerm",
    "gcp",
    "azure_devops",
    "azure_devops_ssh",
    "github",
    "github_ssh",
    "gitlab",
    "bitbucket",
    "bitbucket_ssh",
    "git_public",
    "mongodb_atlas",
    "datadog",
    "postgresql",
    "slack",
]

# integrations that only provide remote state storage (e.g. pg backend), they are used through
# the storage and cannot be attached to a resource
STATE_BACKEND_INTEGRATION_PROVIDERS: frozenset[str] = frozenset({"postgresql"})

type SecretProviderType = Literal["aws", "gcp", "custom"]
