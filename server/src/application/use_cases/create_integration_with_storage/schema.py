from pydantic import ConfigDict, Field

from application.integrations.schema import IntegrationCreate


class IntegrationCreateWithStorage(IntegrationCreate):
    """
    MVP For creating a new integration along with a storage resource
    """

    create_storage: bool = Field(
        default=True,
        description="Flag to indicate whether to create a storage resource along with the integration",
    )

    model_config = ConfigDict(from_attributes=True)
