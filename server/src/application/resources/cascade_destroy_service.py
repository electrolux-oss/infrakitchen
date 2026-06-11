import logging
from uuid import UUID

from application.workflows.schema import WorkflowCreate, WorkflowResponse, WorkflowStepCreate
from application.workflows.service import WorkflowService
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, WorkflowAction
from core.errors import AccessDenied, EntityNotFound
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import ResourceCRUD

logger = logging.getLogger(__name__)


class CascadeDestroyService:
    """
    Orchestrates cascade destruction of a resource and all its descendants.

    The full descendant tree is collected via a single recursive CTE
    (resource_crud.get_tree_to_children). A destroy Workflow is created with
    one step per resource, ordered so that leaves (deepest nodes) have the
    lowest position values and are therefore destroyed first. Resources at
    the same depth share the same position and can be destroyed in parallel
    by WorkflowTask.
    """

    def __init__(
        self,
        resource_crud: ResourceCRUD,
        workflow_service: WorkflowService,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.resource_crud = resource_crud
        self.workflow_service = workflow_service
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
        ordered_resources = await self._collect_descendants_post_order(resource_id)
        if not ordered_resources:
            raise EntityNotFound("Resource not found")

        await self._validate_admin_permissions(ordered_resources, requester)

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

        return workflow

    async def _collect_descendants_post_order(
        self,
        resource_id: UUID,
    ) -> list[tuple[UUID, UUID, int]]:
        """
        Single recursive CTE walk via resource_crud.get_tree_to_children().
        Returns a list of (resource_id, template_id, position) tuples sorted
        leaves-first (lowest position first).

        Handles diamond-shaped graphs by keeping the maximum depth per node.
        Position assignment: position = global_max_depth - node_depth
        This guarantees every descendant has a strictly lower position than
        its ancestors, satisfying action_destroy's children-must-be-gone guard.
        """
        rows = await self.resource_crud.get_tree_to_children(resource_id)
        if not rows:
            return []

        # Deduplicate: keep the maximum depth reached for each node.
        max_depth: dict[UUID, int] = {}
        template_ids: dict[UUID, UUID] = {}
        for row in rows:
            rid = row["id"]
            depth = row["level"]
            if rid not in max_depth or depth > max_depth[rid]:
                max_depth[rid] = depth
                template_ids[rid] = row["template_id"]

        global_max = max(max_depth.values())
        # position = global_max - node_depth  (leaves → 0, root → global_max)
        result = [(rid, template_ids[rid], global_max - depth) for rid, depth in max_depth.items()]
        result.sort(key=lambda t: t[2])
        return result

    async def _validate_admin_permissions(
        self,
        ordered_resources: list[tuple[UUID, UUID, int]],
        requester: UserDTO,
    ) -> None:
        """
        Raise AccessDenied if the requester does not hold admin permission on
        every resource in the cascade tree (root and all descendants).
        """
        denied_ids: list[str] = []

        for resource_id, _, _ in ordered_resources:
            permissions = await user_entity_permissions(requester, resource_id, "resource")
            if "admin" not in permissions:
                denied_ids.append(str(resource_id))

        if denied_ids:
            raise AccessDenied(
                f"Cannot cascade-destroy: admin permission required on all resources in the tree. "
                f"Access denied for resource(s): {', '.join(denied_ids)}"
            )

    @staticmethod
    def _build_steps(ordered_resources: list[tuple[UUID, UUID, int]]) -> list[WorkflowStepCreate]:
        return [
            WorkflowStepCreate(
                template_id=template_id,
                resource_id=resource_id,
                position=position,
            )
            for resource_id, template_id, position in ordered_resources
        ]
