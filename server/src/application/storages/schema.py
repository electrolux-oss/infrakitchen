from datetime import datetime
from typing import Annotated, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.integrations.schema import IntegrationShort

from core.constants.model import ModelState, ModelStatus
from core.users.schema import UserShort

gcp_storage_regions = Literal[
    # Multi-Regions
    "US",
    "EU",
    "ASIA",
]

storage_providers = Literal["aws", "azurerm", "gcp"]


class AWSStorageConfig(BaseModel):
    aws_bucket_name: str = Field(..., frozen=True)
    aws_region: str = Field(..., frozen=True)
    storage_provider: Literal["aws"] = Field(default="aws", frozen=True)


class AzureRMStorageConfig(BaseModel):
    azurerm_resource_group_name: str
    azurerm_storage_account_name: str
    azurerm_container_name: str
    storage_provider: Literal["azurerm"] = Field(default="azurerm", frozen=True)


class GCPStorageConfig(BaseModel):
    gcp_bucket_name: str = Field(..., frozen=True)
    gcp_region: gcp_storage_regions = Field(..., frozen=True)
    storage_provider: Literal["gcp"] = Field(default="gcp", frozen=True)


class StorageResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    state: Literal[
        ModelState.PROVISIONED,
        ModelState.PROVISION,
        ModelState.DESTROY,
        ModelState.DESTROYED,
    ] = Field(default=ModelState.PROVISION)

    status: Literal[
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.READY,
        ModelStatus.QUEUED,
    ] = Field(default=ModelStatus.READY)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    storage_type: Literal["tofu"] = Field(..., frozen=True)
    storage_provider: storage_providers = Field(..., frozen=True)
    integration: IntegrationShort = Field(...)

    configuration: Annotated[
        AWSStorageConfig | GCPStorageConfig | AzureRMStorageConfig, Field(discriminator="storage_provider")
    ] = Field(...)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "storage"


class StorageCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    storage_type: Literal["tofu"] = Field(..., frozen=True)
    storage_provider: storage_providers = Field(..., frozen=True)
    integration_id: uuid.UUID = Field(..., frozen=True)
    configuration: Annotated[
        AWSStorageConfig | GCPStorageConfig | AzureRMStorageConfig, Field(discriminator="storage_provider")
    ] = Field(...)
    labels: list[str] = Field(default_factory=list)


class StorageUpdate(BaseModel):
    description: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)


class StorageShort(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    storage_type: Literal["tofu"] = Field(..., frozen=True)
    storage_provider: storage_providers = Field(..., frozen=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "storage"
