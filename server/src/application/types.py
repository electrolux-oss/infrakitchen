from typing import Literal


type GitProviderType = Literal["github", "gitlab", "bitbucket", "azure_devops", "git_public"]
type CodeLanguageType = Literal["opentofu"]
type StorageProviderType = Literal["aws", "azurerm", "gcp"]
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
    "slack",
]

type SecretProviderType = Literal["aws", "gcp", "custom"]
