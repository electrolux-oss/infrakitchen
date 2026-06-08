import logging
from collections import deque
from uuid import UUID

from application.resource_temp_state.handler import ResourceTempStateHandler
from application.workflows.schema import WorkflowCreate, WorkflowResponse, WorkflowStepCreate
from application.workflows.service import WorkflowService
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, ModelState, WorkflowAction
from core.errors import EntityNotFound, EntityWrongState
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import ResourceCRUD
from .model import Resource

logger = logging.getLogger(__name__)


class CascadeDestroyService:
    """
    Orchestrates cascade destruction of a resource and all its descendants.

    The full descendant tree is collected via BFS over resource.children.
    A destroy Workflow is created with one step per resource, ordered so that
    leaves (deepest nodes) have the lowest position values and are therefore
    destroyed first. Resources at the same BFS depth share the same position
    and can be destroyed in parallel by WorkflowTask.
    """

    def __init__(
        self,
        resource_crud: ResourceCRUD,
        workflow_service: WorkflowService,
        resource_temp_state_handler: ResourceTempStateHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.resource_crud = resource_crud
        self.workflow_service = workflow_service
        self.resource_temp_state_handler = resource_temp_state_handler
        self.event_sender = event_sender
        self.audit_log_handler = audit_log_handler

    async def create_cascade_destroy_workflow(
        self,
        resource_id: UUID,
        requester: UserDTO,
    ) -> WorkflowResponse:
        """
        Build and immediately trigger a destroy Workflow for the given resource
        and all its descendants.

        Destruction order (driven by WorkflowTask):
          position 0  – deepest leaf resources (no active descendants)
          position N  – the root resource specified by *resource_id*

        :param resource_id: Root resource to cascade-destroy.
        :param requester: User triggering the operation.
        :raises EntityNotFound: If the root resource does not exist.
        :raises EntityWrongState: If any resource in the tree is already being
            destroyed or has pending uncommitted changes.
        """
        root = await self.resource_crud.get_by_id(resource_id)
        if root is None:
            raise EntityNotFound("Resource not found")

        ordered_resources = await self._collect_descendants_post_order(root)

        await self._validate_resources(ordered_resources)

        steps = self._build_steps(ordered_resources)

        workflow_create = WorkflowCreate(
            action=WorkflowAction.DESTROY,
            created_by=requester.id,
            steps=steps,
        )
        workflow = await self.workflow_service.create(workflow_create.model_dump(mode="json"), requester)

        await self.audit_log_handler.create_log(workflow.id, requester.id, ModelActions.CASCADE_DESTROY)

        # Kick off immediately - WorkflowTask.start_pipeline routes by workflow.action
        await self.event_sender.send_task(
            workflow.id,
            requester=requester,
            action=ModelActions.EXECUTE,
        )

        logger.info(
            f"Cascade destroy workflow {workflow.id} created for resource {resource_id} "
            f"covering {len(ordered_resources)} resource(s)"
        )

        return WorkflowResponse.model_validate(workflow)

    async def _collect_descendants_post_order(
        self,
        root: Resource,
    ) -> list[tuple[Resource, int]]:
        """
        BFS over resource.children, tracking the maximum depth at which each
        resource is reached.  Returns a list of (resource, position) tuples
        sorted so that leaves (highest depth) come first (lowest position).

        Position assignment:  position = max_depth_in_tree - node_depth
        This guarantees every child has a strictly lower position than its
        parent, satisfying action_destroy's children-must-be-gone guard.
        """
        max_depth: dict[UUID, int] = {}
        resource_map: dict[UUID, Resource] = {}
        queue: deque[tuple[Resource, int]] = deque()
        queue.append((root, 0))

        while queue:
            resource, depth = queue.popleft()
            rid = resource.id

            if rid in max_depth and max_depth[rid] >= depth:
                continue

            max_depth[rid] = depth
            resource_map[rid] = resource

            for child in resource.children:
                loaded_child = await self.resource_crud.get_by_id(child.id)
                if loaded_child is not None:
                    queue.append((loaded_child, depth + 1))

        if not max_depth:
            return []

        global_max = max(max_depth.values())
        # position = global_max - node_depth  (leaves → 0, root → global_max)
        result = [(resource_map[rid], global_max - depth) for rid, depth in max_depth.items()]
        # Sort by position ascending so the list reads leaf→root
        result.sort(key=lambda t: t[1])
        return result

    async def _validate_resources(self, ordered_resources: list[tuple[Resource, int]]) -> None:
        """
        Raise EntityWrongState if any resource in the tree:
          - is already in a DESTROY / DESTROYED state, or
          - has pending uncommitted changes (resource_temp_state).
        """
        blocking_states = {ModelState.DESTROY, ModelState.DESTROYED}
        invalid_ids: list[str] = []
        temp_state_ids: list[str] = []

        for resource, _ in ordered_resources:
            if resource.state in blocking_states:
                invalid_ids.append(str(resource.id))

            temp_state = await self.resource_temp_state_handler.get_by_resource_id(resource_id=resource.id)
            if temp_state is not None:
                temp_state_ids.append(str(resource.id))

        if invalid_ids:
            raise EntityWrongState(
                f"Cannot cascade-destroy: resource(s) already in DESTROY/DESTROYED state: {', '.join(invalid_ids)}"
            )
        if temp_state_ids:
            raise EntityWrongState(
                f"Cannot cascade-destroy: resource(s) have pending uncommitted changes "
                f"(approve or reject first): {', '.join(temp_state_ids)}"
            )

    @staticmethod
    def _build_steps(ordered_resources: list[tuple[Resource, int]]) -> list[WorkflowStepCreate]:
        return [
            WorkflowStepCreate(
                template_id=resource.template_id,
                resource_id=resource.id,
                position=position,
            )
            for resource, position in ordered_resources
        ]
