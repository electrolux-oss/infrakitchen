from typing import Literal


type GitProviderType = Literal["github", "gitlab", "bitbucket", "azure_devops"]
type CodeLanguageType = Literal["opentofu"]
type StorageProviderType = Literal["aws", "azurerm", "gcp"]
type IacToolType = Literal["tofu"]
type IntegrationType = Literal["git", "cloud"]

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
    "mongodb_atlas",
    "datadog",
]

type SecretProviderType = Literal["aws", "gcp", "custom"]
