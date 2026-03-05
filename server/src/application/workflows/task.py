from datetime import UTC, datetime
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from application.resources.schema import ResourceCreate, Variables
from application.resources.service import ResourceService
from application.source_code_versions.service import SourceCodeVersionService
from application.templates.service import TemplateService
from application.workflows.model import Workflow, WorkflowStep
from application.workflows.schema import WorkflowResponse
from application.workflows.service import WorkflowService
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.errors import CannotProceed
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

logger = logging.getLogger(__name__)


class WorkflowTask:
    def __init__(
        self,
        session: AsyncSession,
        workflow_service: WorkflowService,
        workflow_instance: Workflow,
        template_service: TemplateService,
        resource_service: ResourceService,
        source_code_version_service: SourceCodeVersionService,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
    ) -> None:
        self.session: AsyncSession = session
        self.workflow_service: WorkflowService = workflow_service
        self.workflow_instance: Workflow = workflow_instance
        self.event_sender: EventSender = event_sender
        self.logger: EntityLogger = logger
        self.resource_service: ResourceService = resource_service
        self.template_service: TemplateService = template_service
        self.source_code_version_service: SourceCodeVersionService = source_code_version_service
        self.user: UserDTO = user
        self.action: ModelActions = action

    # workflow states
    async def start_pipeline(self):
        self.logger.debug(f"Starting pipeline for {self.workflow_instance.id} with action {self.action}")
        self.resource_service.audit_log_handler.trace_id = str(self.workflow_instance.id)
        match self.action:
            case ModelActions.EXECUTE:
                self.logger.info(f"Starting pipeline with action {self.action}")
                await self.execute_entity()
            case _:
                raise CannotProceed(f"Unknown action: {self.action}")

    async def manage_resource(self, step: WorkflowStep):
        async def create_resource():
            if step.resource_id:
                self.logger.debug(f"Step {step.id} already has resource {step.resource_id}, skipping resource creation")
                return

            template = await self.template_service.get_by_id(step.template_id)
            if not template:
                raise CannotProceed(f"Template {step.template_id} not found for step {step.id}")

            if not template.configuration.naming_convention:
                raise CannotProceed(f"Template {template.id} does not have a naming convention defined")

            resource = ResourceCreate(
                name=template.configuration.naming_convention,
                template_id=step.template_id,
                source_code_version_id=step.source_code_version_id,
                parents=step.parent_resource_ids,
                integration_ids=step.integration_ids,
                secret_ids=step.secret_ids,
                variables=[Variables(name=k, value=v) for k, v in step.resolved_variables.items()],
                dependency_config=[],
                dependency_tags=[],
                storage_id=step.storage_id,
                storage_path=f"service-catalog/{template.template}/{template.configuration.naming_convention}/terraform.tfstate",
                workspace_id=None,
            )
            created_resource = await self.resource_service.create(
                resource=resource,
                requester=self.user,
            )
            step.resource_id = created_resource.id
            await self.change_step_status(
                step,
                new_status=ModelStatus.APPROVAL_PENDING,
                send_task=True,
            )

        if step.status == ModelStatus.PENDING:
            await self.change_step_status(
                step,
                new_status=ModelStatus.IN_PROGRESS,
            )
            await create_resource()
        elif step.status == ModelStatus.APPROVAL_PENDING and step.resource_id:
            self.logger.debug(f"Step {step.id} is pending approval, skipping resource creation")
            resource = await self.resource_service.get_by_id(step.resource_id)
            if not resource:
                raise CannotProceed(f"Resource {step.resource_id} not found for step {step.id}")

            if resource.status == ModelStatus.APPROVAL_PENDING:
                approved = await self.resource_service.patch_action(
                    resource.id,
                    PatchBodyModel(action=ModelActions.APPROVE),
                    requester=self.user,
                )
                await self.change_step_status(
                    step,
                    new_status=approved.status,
                    send_task=True,
                )
            else:
                await self.change_step_status(
                    step,
                    new_status=resource.status,
                    send_task=True,
                )

        elif step.resource_id:
            resource = await self.resource_service.get_by_id(step.resource_id)
            if not resource:
                raise CannotProceed(f"Resource {step.resource_id} not found for step {step.id}")

            if resource.status == ModelStatus.DONE:
                # Resource provisioning complete — mark step done
                await self.change_step_status(
                    step,
                    new_status=ModelStatus.DONE,
                )
            elif resource.status == ModelStatus.READY:
                resource = await self.resource_service.patch_action(
                    step.resource_id,
                    PatchBodyModel(action=ModelActions.EXECUTE),
                    requester=self.user,
                )
                # Resource task will callback via trace_id when done
                await self.change_step_status(
                    step,
                    new_status=resource.status,
                )
            elif resource.status == ModelStatus.ERROR and step.status != ModelStatus.ERROR:
                raise CannotProceed(f"Resource {resource.id} is in error state")
            elif resource.status == ModelStatus.ERROR and step.status == ModelStatus.ERROR:
                resource = await self.resource_service.patch_action(
                    step.resource_id,
                    PatchBodyModel(action=ModelActions.EXECUTE),
                    requester=self.user,
                )
                await self.change_step_status(
                    step,
                    new_status=resource.status,
                )
                # Resource task will callback via trace_id when done
            elif resource.status == ModelStatus.IN_PROGRESS:
                # Resource is still provisioning — wait for callback, don't poll
                self.logger.debug(f"Step {step.id} resource {step.resource_id} still in progress, waiting for callback")
                await self.change_step_status(
                    step,
                    new_status=ModelStatus.IN_PROGRESS,
                )
            else:
                # Sync step status with resource status
                await self.change_step_status(
                    step,
                    new_status=resource.status,
                )
        else:
            raise CannotProceed(f"Step {step.id} is in unexpected state {step.status} without resource")

    async def execute_entity(self):
        await self.change_entity_status(new_status=ModelStatus.IN_PROGRESS)

        for step in self.workflow_instance.steps:
            if step.status == ModelStatus.DONE:
                self.logger.debug(f"Step {step.id} already completed, skipping")
                continue
            try:
                await self.manage_resource(step)
                # If step is not done yet, wait for resource callback
                if step.status != ModelStatus.DONE:
                    return
                # Step is done — continue to next step
            except Exception as exc:
                await self.change_step_status(
                    step,
                    new_status=ModelStatus.ERROR,
                    error_message=str(exc),
                )
                await self.change_entity_status(new_status=ModelStatus.ERROR)
                return  # stop on first failure

        # All steps completed
        self.logger.info("All workflow steps completed")
        self.workflow_instance.completed_at = datetime.now(UTC)
        await self.change_entity_status(new_status=ModelStatus.DONE)

    # change entity state depends on task state
    async def change_entity_status(
        self,
        new_status: ModelStatus | None = None,
        event_type: str = ModelActions.EXECUTE,
    ) -> None:
        if new_status:
            self.workflow_instance.status = new_status

        await self.session.commit()
        await self.session.refresh(self.workflow_instance)

        response_model = WorkflowResponse.model_validate(self.workflow_instance)
        await self.event_sender.send_event(response_model, event_type)

    async def change_step_status(
        self,
        step: WorkflowStep,
        new_status: ModelStatus | None = None,
        error_message: str | None = None,
        send_task: bool = False,
    ) -> None:
        if new_status:
            step.status = new_status

        step.error_message = error_message

        await self.session.commit()
        await self.session.refresh(self.workflow_instance)

        response_model = WorkflowResponse.model_validate(self.workflow_instance)
        await self.event_sender.send_event(response_model, ModelActions.EXECUTE)
        if send_task:
            await self.event_sender.send_task(
                self.workflow_instance.id,
                requester=self.user,
                action=ModelActions.EXECUTE,
            )

    async def make_failed(self) -> None:
        await self.change_entity_status(new_status=ModelStatus.ERROR)
