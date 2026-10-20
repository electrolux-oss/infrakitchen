from collections.abc import Collection
from dataclasses import dataclass
import logging
from enum import Enum
from typing import Any
from uuid import UUID

from application.workflows.schema import WorkflowCreate, WorkflowResponse, WorkflowStepCreate
from application.workflows.service import WorkflowService
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions, ModelState, ModelStatus, WorkflowAction
from core.errors import AccessDenied, EntityNotFound, EntityWrongState
from core.users.model import UserDTO

from .cascade_destroy_service import collect_tree_depths
from .crud import ResourceCRUD
from .service import ResourceService

logger = logging.getLogger(__name__)

DESELECTED = "deselected"
# Rows of the tree walk (one per path) a cascade may read
MAX_TREE_ROWS = 5000

CASCADE_AUDIT_ACTIONS = {
    WorkflowAction.PLAN: ModelActions.CASCADE_DRYRUN,
    WorkflowAction.APPLY: ModelActions.CASCADE_EXECUTE,
}


def _as_enum[E: Enum](enum_cls: type[E], value: Any) -> E:
    """Raw SQL returns the stored enum member name (e.g. "DONE"), not its value."""
    if isinstance(value, enum_cls):
        return value
    try:
        return enum_cls[value]
    except KeyError:
        return enum_cls(value)


@dataclass
class CascadeNode:
    resource_id: UUID
    template_id: UUID
    name: str
    depth: int
    included: bool
    reason: str | None = None


class CascadeRunService:
    """
    Builds plan or apply Workflows for a resource and all its descendants.

    Steps run parent-first: a step's position is the resource's deepest level
    in the tree, so every resource runs after all of its in-tree parents.
    Apply never approves anything: resources waiting for approval are skipped,
    together with any descendants that depend on them being provisioned.
    """

    def __init__(
        self,
        resource_crud: ResourceCRUD,
        resource_service: ResourceService,
        workflow_service: WorkflowService,
        audit_log_handler: AuditLogHandler,
    ):
        self.resource_crud = resource_crud
        self.resource_service = resource_service
        self.workflow_service = workflow_service
        self.audit_log_handler = audit_log_handler

    async def preview(
        self,
        resource_id: UUID,
        action: WorkflowAction,
        requester: UserDTO,
        exclude_ids: Collection[UUID] = (),
    ) -> list[CascadeNode]:
        """
        Decide which resources of the tree the cascade runs.

        Resources in exclude_ids were deselected by the user and are skipped
        like any other: on apply, an unprovisioned one also skips its children.

        :raises EntityNotFound: If the root resource does not exist.
        :raises EntityWrongState: If a resource in the tree is busy.
        :raises AccessDenied: If the requester cannot run a resource in the tree.
        """
        if action not in CASCADE_AUDIT_ACTIONS:
            raise ValueError(f"Unsupported cascade action: {action}")

        rows = await self.resource_crud.get_tree_to_children(resource_id, limit=MAX_TREE_ROWS + 1)
        if not rows:
            raise EntityNotFound("Resource not found")
        if len(rows) > MAX_TREE_ROWS:
            raise EntityWrongState("Resource tree is too large for a cascade run")

        depths = collect_tree_depths(rows)
        info: dict[UUID, dict[str, Any]] = {}
        tree_parents: dict[UUID, set[UUID]] = {}
        for row in rows:
            if row["id"] not in info:
                info[row["id"]] = {
                    **row,
                    "state": _as_enum(ModelState, row["state"]),
                    "status": _as_enum(ModelStatus, row["status"]),
                }
            # child_id is the node the walk came from, i.e. this resource's parent in the tree
            if row.get("child_id"):
                tree_parents.setdefault(row["id"], set()).add(row["child_id"])

        excluded = {UUID(str(i)) for i in exclude_ids}
        if unknown := excluded - info.keys():
            raise EntityNotFound(f"Excluded resources are not in the tree: {', '.join(sorted(map(str, unknown)))}")
        nodes: dict[UUID, CascadeNode] = {}
        # Resources the children cannot be applied on top of
        blocking: set[UUID] = set()
        busy: list[str] = []
        denied: list[str] = []

        for rid in sorted(depths, key=lambda r: depths[r][1]):
            template_id, depth = depths[rid]
            row = info[rid]
            node = CascadeNode(resource_id=rid, template_id=template_id, name=row["name"], depth=depth, included=False)
            nodes[rid] = node

            if row["state"] == ModelState.DESTROYED:
                node.reason = "destroyed"
                blocking.add(rid)
                continue
            if rid in excluded:
                node.reason = DESELECTED
                if self._is_blocking(row, tree_parents.get(rid, set()), blocking):
                    blocking.add(rid)
                continue
            if row["status"] in (ModelStatus.QUEUED, ModelStatus.IN_PROGRESS):
                busy.append(row["name"])
                continue

            actions = await self.resource_service.get_actions(rid, requester, include_cascade=False)
            if not actions:
                denied.append(row["name"])
                continue

            if action == WorkflowAction.PLAN:
                node.reason = self._plan_skip_reason(row, actions)
            else:
                node.reason = self._apply_skip_reason(row, actions)
                if node.reason is None and tree_parents.get(rid, set()) & blocking:
                    node.reason = "parent not provisioned"
                if node.reason is not None and self._is_blocking(row, tree_parents.get(rid, set()), blocking):
                    blocking.add(rid)

            node.included = node.reason is None

        if busy:
            raise EntityWrongState(f"Resources are busy, try again when they finish: {', '.join(busy)}")
        if denied:
            raise AccessDenied(f"Write permission required on all resources in the tree: {', '.join(denied)}")

        return sorted(nodes.values(), key=lambda n: n.depth)

    async def create_workflow(
        self,
        resource_id: UUID,
        action: WorkflowAction,
        requester: UserDTO,
        exclude_ids: Collection[UUID] = (),
    ) -> WorkflowResponse:
        """Build a plan or apply Workflow for the tree. It runs when the user executes it."""
        nodes = await self.preview(resource_id, action, requester, exclude_ids)
        included = [n for n in nodes if n.included]
        if not included:
            raise EntityWrongState(f"Nothing to {action} in this resource tree")

        steps = [
            WorkflowStepCreate(template_id=n.template_id, resource_id=n.resource_id, position=n.depth) for n in included
        ]
        workflow_create = WorkflowCreate(action=action, created_by=requester.id, steps=steps)
        workflow = await self.workflow_service.create(workflow_create.model_dump(mode="json"), requester)

        await self.audit_log_handler.create_log(workflow.id, requester.id, CASCADE_AUDIT_ACTIONS[action])

        logger.info(
            f"Cascade {action} workflow {workflow.id} created (not started) for resource {resource_id} "
            f"covering {len(included)} of {len(nodes)} resource(s)"
        )
        return workflow

    @staticmethod
    def _is_blocking(row: dict[str, Any], parents: set[UUID], blocking: set[UUID]) -> bool:
        """A skipped resource blocks its children unless it is provisioned under provisioned parents."""
        return row["state"] != ModelState.PROVISIONED or bool(parents & blocking)

    @staticmethod
    def _plan_skip_reason(row: dict[str, Any], actions: list[str]) -> str | None:
        if row.get("abstract"):
            return "abstract"
        if row["state"] == ModelState.DESTROY:
            return "destroy pending"
        if ModelActions.DRYRUN not in actions:
            return row["status"].value.replace("_", " ")
        return None

    @staticmethod
    def _apply_skip_reason(row: dict[str, Any], actions: list[str]) -> str | None:
        if row.get("abstract"):
            return "abstract"
        if row["state"] == ModelState.DESTROY:
            return "destroy pending"
        if row["status"] == ModelStatus.APPROVAL_PENDING:
            return "waiting for approval"
        if row["status"] == ModelStatus.REJECTED:
            return "rejected"
        if ModelActions.EXECUTE not in actions or row["state"] not in (ModelState.PROVISION, ModelState.PROVISIONED):
            return row["status"].value.replace("_", " ")
        return None
