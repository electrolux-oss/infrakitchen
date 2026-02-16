import logging

from application.integrations.schema import (
    AWSIntegrationConfig,
    AzureRMIntegrationConfig,
    GCPIntegrationConfig,
    IntegrationCreate,
    IntegrationResponse,
)
from application.integrations.service import IntegrationService
from application.storages.schema import StorageCreate
from application.storages.service import StorageService
from application.use_cases.create_integration_with_storage.schema import IntegrationCreateWithStorage
from core.audit_logs.handler import AuditLogHandler
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender
from core.users.model import UserDTO


logger = logging.getLogger(__name__)


class IntegrationWithStorageService:
    def __init__(
        self,
        integration_service: IntegrationService,
        storage_service: StorageService,
        revision_handler: RevisionHandler,
        storage_event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.integration_service: IntegrationService = integration_service
        self.storage_service: StorageService = storage_service
        self.revision_handler: RevisionHandler = revision_handler
        self.storage_event_sender: EventSender = storage_event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def create(
        self, integration_with_storage: IntegrationCreateWithStorage, requester: UserDTO
    ) -> IntegrationResponse:
        """
        Create a new template.
        :param template: TemplateCreate to create
        :param requester: User who creates the template
        :return: Created template
        """
        body = integration_with_storage.model_dump(exclude_unset=True)
        body["created_by"] = requester.id

        integration = IntegrationCreate.model_validate(body)
        new_integration = await self.integration_service.create(integration, requester=requester)

        # Create Storage if required. Currently only AWS, GCP, and AzureRM are supported.
        if integration_with_storage.create_storage and integration_with_storage.integration_provider in [
            "aws",
            "gcp",
            "azurerm",
        ]:
            if isinstance(integration.configuration, AWSIntegrationConfig):
                configuration = {
                    "aws_bucket_name": f"infrakitchen-{integration.configuration.aws_account}-bucket",
                    "aws_region": integration.configuration.aws_default_region or "us-east-1",
                    "storage_provider": "aws",
                }
            elif isinstance(integration.configuration, GCPIntegrationConfig):
                configuration = {
                    "gcp_bucket_name": f"infrakitchen-{integration.configuration.gcp_project_id}-bucket",
                    "gcp_region": "US",
                    "storage_provider": "gcp",
                }
            elif isinstance(integration.configuration, AzureRMIntegrationConfig):
                # TODO: need to test it in Azure
                configuration = {
                    "azurerm_resource_group_name": f"infrakitchen-{new_integration.name}-rg",
                    "azurerm_storage_account_name": f"infrakitchen{new_integration.name}sa".replace("-", ""),
                    "azurerm_container_name": f"infrakitchen-{new_integration.name}-container",
                    "storage_provider": "azurerm",
                }
            else:
                raise ValueError("Provider is not supported")

            storage = StorageCreate.model_validate(
                dict(
                    name=f"infrakitchen_{new_integration.name}",
                    storage_type="tofu",
                    storage_provider=integration.integration_provider,
                    integration_id=new_integration.id,
                    configuration=configuration,
                    created_by=requester.id,
                )
            )
            new_storage = await self.storage_service.create(storage, requester=requester)
            await self.storage_event_sender.send_task(new_storage.id, requester=requester)
        return new_integration
