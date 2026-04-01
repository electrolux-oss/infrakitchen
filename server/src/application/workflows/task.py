from datetime import UTC, datetime
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

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
        step_id: str | None = None,
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
        self.step_id: str | None = step_id

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

            parent_resources = step.parent_resource_ids
            if not parent_resources and template.parents:
                parent_resources = [
                    stp.resource_id
                    for stp in self.workflow_instance.steps
                    if stp.template_id in [parent.id for parent in template.parents] and stp.resource_id is not None
                ]

            # Resolve wired variables from completed upstream resources
            wired_vars = await self._resolve_wired_variables(step)
            if wired_vars:
                step.resolved_variables = {**step.resolved_variables, **wired_vars}
                flag_modified(step, "resolved_variables")
                self.logger.info(f"Resolved wired variables for step {step.id}: {list(wired_vars.keys())}")

            resource = ResourceCreate(
                name=template.configuration.naming_convention,
                template_id=step.template_id,
                source_code_version_id=step.source_code_version_id,
                parents=parent_resources,
                integration_ids=[i.id for i in step.integration_ids],
                secret_ids=[s.id for s in step.secret_ids],
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

        if step.status == ModelStatus.PENDING or (step.status == ModelStatus.ERROR and step.resource_id is None):
            await self.change_step_status(
                step,
                new_status=ModelStatus.IN_PROGRESS,
            )
            await create_resource()
        elif step.status == ModelStatus.APPROVAL_PENDING and step.resource_id:
            self.logger.info(f"Step {step.id} is pending approval, approving resource {step.resource_id}")
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
                # Resource task will callback via trace_id when done
                resource = await self.resource_service.patch_action(
                    step.resource_id,
                    PatchBodyModel(action=ModelActions.EXECUTE),
                    requester=self.user,
                    trace_id=str(self.workflow_instance.id),
                )
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
                    trace_id=str(self.workflow_instance.id),
                )
                await self.change_step_status(
                    step,
                    new_status=resource.status,
                )
            elif resource.status == ModelStatus.IN_PROGRESS:
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
        self.logger.info(f"Executing workflow {self.workflow_instance.id}")
        await self.change_entity_status(new_status=ModelStatus.IN_PROGRESS)

        # If a specific step_id was provided, process only that step
        if self.step_id:
            target_step = next((s for s in self.workflow_instance.steps if str(s.id) == self.step_id), None)
            if target_step and target_step.status != ModelStatus.DONE:
                self.logger.info(f"Processing targeted step {self.step_id}")
                try:
                    await self.manage_resource(target_step)
                except Exception as exc:
                    await self.change_step_status(
                        target_step,
                        new_status=ModelStatus.ERROR,
                        error_message=str(exc),
                    )
                    await self.change_entity_status(new_status=ModelStatus.ERROR)
                    return

                # After targeted step completes, launch any newly unblocked steps
                if target_step.status == ModelStatus.DONE:
                    await self._launch_ready_steps()
                return

        # No specific step — process all ready steps (initial launch)
        await self._launch_ready_steps()

    async def _launch_ready_steps(self):
        """Find and launch all steps at the current position level."""
        # Group steps by position (already ordered by position via relationship)
        steps = self.workflow_instance.steps

        # Find the lowest position that has non-DONE steps
        current_position: int | None = None
        for step in steps:
            if step.status != ModelStatus.DONE:
                current_position = step.position
                break

        if current_position is None:
            # All steps are DONE
            self.logger.info("All workflow steps completed")
            self.workflow_instance.completed_at = datetime.now(UTC)
            await self.change_entity_status(new_status=ModelStatus.DONE)
            return

        # Check that all steps at prior positions are DONE
        for step in steps:
            if step.position < current_position and step.status != ModelStatus.DONE:
                self.logger.warning(f"Step {step.id} at position {step.position} is not done, cannot proceed")
                return

        # Collect all steps at the current position that need processing
        current_steps = [s for s in steps if s.position == current_position]

        # If any step at this level is in-progress, wait for callbacks
        if all(s.status in (ModelStatus.IN_PROGRESS, ModelStatus.APPROVAL_PENDING) for s in current_steps):
            return

        has_error = False
        for step in current_steps:
            if step.status == ModelStatus.DONE:
                continue
            if step.status in (ModelStatus.IN_PROGRESS, ModelStatus.APPROVAL_PENDING):
                continue

            try:
                await self.manage_resource(step)
            except Exception as exc:
                has_error = True
                await self.change_step_status(
                    step,
                    new_status=ModelStatus.ERROR,
                    error_message=str(exc),
                )

        if has_error:
            await self.change_entity_status(new_status=ModelStatus.ERROR)
            return

        # If all steps at current position completed immediately, advance to next level
        all_current_done = all(s.status == ModelStatus.DONE for s in current_steps)
        if all_current_done:
            await self._launch_ready_steps()

    # change entity state depends on task state
    async def change_entity_status(
        self,
        new_status: ModelStatus | None = None,
        event_type: str = ModelActions.EXECUTE,
    ) -> None:
        if new_status:
            self.workflow_instance.status = new_status

        await self.session.commit()
        refreshed = await self.workflow_service.crud.get_by_id(self.workflow_instance.id)
        if refreshed:
            self.workflow_instance = refreshed

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
        refreshed = await self.workflow_service.crud.get_by_id(self.workflow_instance.id)
        if refreshed:
            self.workflow_instance = refreshed

        response_model = WorkflowResponse.model_validate(self.workflow_instance)
        await self.event_sender.send_event(response_model, ModelActions.EXECUTE)
        self.logger.info(f"Step {step.id} status updated to {step.status}")
        if send_task:
            await self.event_sender.send_task(
                self.workflow_instance.id,
                requester=self.user,
                action=ModelActions.EXECUTE,
                extra_metadata={"step_id": str(step.id)},
            )
            self.logger.info(f"Sent task to process step {step.id}")

    async def _resolve_wired_variables(self, step: WorkflowStep) -> dict[str, Any]:
        """
        Resolve wired variables from completed upstream resources and constant blocks.

        For each wiring rule targeting this step's template:
        - If source is a completed step with a resource:
          - "input:<name>" outputs → use the source resource's variable value
          - Regular outputs → use the source resource's output value
        - If source has no step (constant/external block):
          - Infer the constant value from another completed step that received
            the same constant output via wiring
        """
        wired_vars: dict[str, Any] = {}
        template_id_str = str(step.template_id)

        step_by_template: dict[str, WorkflowStep] = {str(s.template_id): s for s in self.workflow_instance.steps}

        resource_cache: dict[str, Any] = {}

        for rule in self.workflow_instance.wiring_snapshot:
            source_tid = str(rule["source_template_id"])
            target_tid = str(rule["target_template_id"])

            if target_tid != template_id_str:
                continue

            source_output: str = rule["source_output"]
            target_variable: str = rule["target_variable"]

            source_step = step_by_template.get(source_tid)

            if source_step and source_step.resource_id and source_step.status == ModelStatus.DONE:
                # Fetch resource (cached)
                rid = str(source_step.resource_id)
                if rid not in resource_cache:
                    resource_cache[rid] = await self.resource_service.get_by_id(source_step.resource_id)

                resource = resource_cache.get(rid)
                if not resource:
                    self.logger.warning(f"Resource {rid} not found for completed step {source_step.id}")
                    continue

                if source_output.startswith("input:"):
                    # Input forwarding: use the source resource's variable
                    var_name = source_output[len("input:") :]
                    for v in resource.variables:
                        if v.name == var_name:
                            wired_vars[target_variable] = v.value
                            break
                    else:
                        self.logger.warning(f"Variable '{var_name}' not found in resource {rid} for input wire")
                else:
                    # Regular output
                    for o in resource.outputs:
                        if o.name == source_output:
                            wired_vars[target_variable] = o.value
                            break
                    else:
                        self.logger.warning(f"Output '{source_output}' not found in resource {rid}")

            elif not source_step:
                # Constant/external block without a workflow step.
                # Infer the value from a completed step that also received
                # the same output from this constant via another wiring rule.
                for other_rule in self.workflow_instance.wiring_snapshot:
                    if (
                        str(other_rule["source_template_id"]) == source_tid
                        and other_rule["source_output"] == source_output
                        and str(other_rule["target_template_id"]) != template_id_str
                    ):
                        other_step = step_by_template.get(str(other_rule["target_template_id"]))
                        if other_step and other_step.status == ModelStatus.DONE:
                            other_var = other_rule["target_variable"]
                            if other_var in other_step.resolved_variables:
                                wired_vars[target_variable] = other_step.resolved_variables[other_var]
                                break
                else:
                    if target_variable not in wired_vars:
                        self.logger.warning(
                            f"Could not resolve constant wire {source_tid}:{source_output} → {target_variable}"
                        )

        return wired_vars

    async def make_failed(self) -> None:
        await self.change_entity_status(new_status=ModelStatus.ERROR)
