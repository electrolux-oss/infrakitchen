from datetime import datetime
from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import UUID, uuid4

import pytest

from application.resources.cascade_run_service import MAX_TREE_ROWS, CascadeRunService
from application.workflows.schema import WorkflowResponse
from core.constants.model import ModelActions, ModelState, ModelStatus, WorkflowAction
from core.errors import AccessDenied, EntityNotFound, EntityWrongState

ALL_ACTIONS = [ModelActions.DRYRUN, ModelActions.EXECUTE]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class Tree:
    """Builds get_tree_to_children() rows. child_id is the node's parent in the tree."""

    def __init__(self):
        self.rows: list[dict[str, Any]] = []
        self.ids: dict[str, UUID] = {}

    def add(
        self,
        name: str,
        parent: str | None = None,
        level: int = 0,
        *,
        state: ModelState = ModelState.PROVISIONED,
        status: ModelStatus = ModelStatus.DONE,
        abstract: bool = False,
    ) -> "Tree":
        rid = self.ids.setdefault(name, uuid4())
        self.rows.append(
            {
                "id": rid,
                "template_id": uuid4(),
                "child_id": self.ids[parent] if parent else None,
                "name": name,
                "state": state,
                "status": status,
                "abstract": abstract,
                "level": level,
            }
        )
        return self


def _make_service(tree: Tree, actions: dict[str, list[str]] | None = None) -> CascadeRunService:
    actions = actions or {}
    names = {rid: name for name, rid in tree.ids.items()}

    resource_crud = Mock()
    resource_crud.get_tree_to_children = AsyncMock(return_value=tree.rows)

    resource_service = Mock()

    async def get_actions(rid, requester, **kwargs):
        return actions.get(names[rid], ALL_ACTIONS)

    resource_service.get_actions = AsyncMock(side_effect=get_actions)

    workflow_service = Mock()
    workflow_service.patch_action = AsyncMock()
    workflow_service.create = AsyncMock(
        return_value=WorkflowResponse(
            id=uuid4(),
            action=WorkflowAction.APPLY,
            status=ModelStatus.PENDING,
            steps=[],
            created_at=datetime.now(),
        )
    )

    audit = Mock()
    audit.create_log = AsyncMock()

    return CascadeRunService(
        resource_crud=resource_crud,
        resource_service=resource_service,
        workflow_service=workflow_service,
        audit_log_handler=audit,
    )


def _by_name(nodes) -> dict[str, Any]:
    return {n.name: n for n in nodes}


def _created_steps(service: CascadeRunService) -> list[dict[str, Any]]:
    body = cast(AsyncMock, service.workflow_service.create).call_args[0][0]
    return body["steps"]


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------


class TestOrdering:
    @pytest.mark.asyncio
    async def test_parents_run_before_children(self, mock_user_dto):
        tree = Tree().add("root").add("a", "root", 1).add("b", "a", 2)
        service = _make_service(tree)

        await service.create_workflow(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto)

        positions = {s["resource_id"]: s["position"] for s in _created_steps(service)}
        assert positions == {str(tree.ids["root"]): 0, str(tree.ids["a"]): 1, str(tree.ids["b"]): 2}

    @pytest.mark.asyncio
    async def test_diamond_keeps_deepest_level(self, mock_user_dto):
        # d hangs off the root directly and off b, so it must wait for b
        tree = Tree().add("root").add("b", "root", 1).add("d", "root", 1).add("d", "b", 2)
        service = _make_service(tree)

        await service.create_workflow(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto)

        steps = _created_steps(service)
        positions = {s["resource_id"]: s["position"] for s in steps}
        assert len(steps) == 3
        assert positions[str(tree.ids["d"])] == 2


# ---------------------------------------------------------------------------
# Apply eligibility
# ---------------------------------------------------------------------------


class TestApplySkips:
    @pytest.mark.asyncio
    async def test_skips_pending_approval_and_never_approves(self, mock_user_dto):
        tree = Tree().add("root").add("pending", "root", 1, status=ModelStatus.APPROVAL_PENDING)
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["root"].included
        assert not nodes["pending"].included
        assert nodes["pending"].reason == "waiting for approval"

    @pytest.mark.asyncio
    async def test_skips_rejected(self, mock_user_dto):
        tree = Tree().add("root").add("rej", "root", 1, status=ModelStatus.REJECTED)
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["rej"].reason == "rejected"

    @pytest.mark.asyncio
    async def test_unprovisioned_skipped_parent_skips_descendants(self, mock_user_dto):
        tree = (
            Tree()
            .add("root")
            .add("new", "root", 1, state=ModelState.PROVISION, status=ModelStatus.APPROVAL_PENDING)
            .add("child", "new", 2, state=ModelState.PROVISION, status=ModelStatus.READY)
            .add("grandchild", "child", 3, state=ModelState.PROVISION, status=ModelStatus.READY)
        )
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["new"].reason == "waiting for approval"
        assert nodes["child"].reason == "parent not provisioned"
        assert nodes["grandchild"].reason == "parent not provisioned"

    @pytest.mark.asyncio
    async def test_provisioned_skipped_parent_keeps_children(self, mock_user_dto):
        # The parent has pending edits but its infrastructure exists, so children can apply
        tree = Tree().add("root").add("edited", "root", 1, status=ModelStatus.APPROVAL_PENDING).add("c", "edited", 2)
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert not nodes["edited"].included
        assert nodes["c"].included

    @pytest.mark.asyncio
    async def test_abstract_is_skipped_but_children_run(self, mock_user_dto):
        tree = Tree().add("root").add("abs", "root", 1, abstract=True).add("c", "abs", 2)
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["abs"].reason == "abstract"
        assert nodes["c"].included

    @pytest.mark.asyncio
    async def test_destroyed_is_skipped_without_permission_check(self, mock_user_dto):
        tree = Tree().add("root").add("gone", "root", 1, state=ModelState.DESTROYED)
        service = _make_service(tree, actions={"gone": []})

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["gone"].reason == "destroyed"


class TestPlanEligibility:
    @pytest.mark.asyncio
    async def test_plans_pending_approval_resources(self, mock_user_dto):
        tree = Tree().add("root").add("pending", "root", 1, status=ModelStatus.APPROVAL_PENDING)
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto))

        assert nodes["pending"].included

    @pytest.mark.asyncio
    async def test_skips_abstract(self, mock_user_dto):
        tree = Tree().add("root").add("abs", "root", 1, abstract=True)
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto))

        assert nodes["abs"].reason == "abstract"


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class TestErrors:
    @pytest.mark.asyncio
    async def test_root_not_found(self, mock_user_dto):
        service = _make_service(Tree())

        with pytest.raises(EntityNotFound):
            await service.preview(uuid4(), WorkflowAction.APPLY, mock_user_dto)

    @pytest.mark.asyncio
    async def test_busy_resource_blocks(self, mock_user_dto):
        tree = Tree().add("root").add("running", "root", 1, status=ModelStatus.IN_PROGRESS)
        service = _make_service(tree)

        with pytest.raises(EntityWrongState, match="running"):
            await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto)

    @pytest.mark.asyncio
    async def test_missing_permission_denies(self, mock_user_dto):
        tree = Tree().add("root").add("locked", "root", 1)
        service = _make_service(tree, actions={"locked": []})

        with pytest.raises(AccessDenied, match="locked"):
            await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto)

    @pytest.mark.asyncio
    async def test_nothing_to_run(self, mock_user_dto):
        tree = Tree().add("root", abstract=True)
        service = _make_service(tree)

        with pytest.raises(EntityWrongState, match="Nothing to apply"):
            await service.create_workflow(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto)
        cast(AsyncMock, service.workflow_service.create).assert_not_called()


# ---------------------------------------------------------------------------
# Workflow creation
# ---------------------------------------------------------------------------


class TestCreateWorkflow:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "action, audit_action",
        [
            (WorkflowAction.PLAN, ModelActions.CASCADE_DRYRUN),
            (WorkflowAction.APPLY, ModelActions.CASCADE_EXECUTE),
        ],
    )
    async def test_creates_workflow_without_starting(self, mock_user_dto, action, audit_action):
        tree = Tree().add("root").add("a", "root", 1)
        service = _make_service(tree)

        workflow = await service.create_workflow(tree.ids["root"], action, mock_user_dto)

        body = cast(AsyncMock, service.workflow_service.create).call_args[0][0]
        assert body["action"] == action
        cast(AsyncMock, service.audit_log_handler.create_log).assert_awaited_once_with(
            workflow.id, mock_user_dto.id, audit_action
        )
        # Creating the workflow does not start it
        cast(AsyncMock, service.workflow_service.patch_action).assert_not_awaited()

    @pytest.mark.asyncio
    async def test_skipped_resources_get_no_step(self, mock_user_dto):
        tree = Tree().add("root").add("pending", "root", 1, status=ModelStatus.APPROVAL_PENDING)
        service = _make_service(tree)

        await service.create_workflow(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto)

        assert [s["resource_id"] for s in _created_steps(service)] == [str(tree.ids["root"])]


# ---------------------------------------------------------------------------
# Deselected resources
# ---------------------------------------------------------------------------


class TestDeselected:
    @pytest.mark.asyncio
    async def test_deselected_provisioned_parent_keeps_children(self, mock_user_dto):
        tree = Tree().add("root").add("a", "root", 1).add("b", "a", 2)
        service = _make_service(tree)

        await service.create_workflow(
            tree.ids["root"], WorkflowAction.APPLY, mock_user_dto, exclude_ids=[tree.ids["a"]]
        )

        assert {s["resource_id"] for s in _created_steps(service)} == {str(tree.ids["root"]), str(tree.ids["b"])}

    @pytest.mark.asyncio
    async def test_deselected_unprovisioned_skips_children_on_apply(self, mock_user_dto):
        tree = (
            Tree()
            .add("root")
            .add("new", "root", 1, state=ModelState.PROVISION, status=ModelStatus.READY)
            .add("child", "new", 2, state=ModelState.PROVISION, status=ModelStatus.READY)
        )
        service = _make_service(tree)

        nodes = _by_name(
            await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto, exclude_ids=[tree.ids["new"]])
        )

        assert nodes["new"].reason == "deselected"
        assert nodes["child"].reason == "parent not provisioned"

    @pytest.mark.asyncio
    async def test_deselected_unprovisioned_keeps_children_on_plan(self, mock_user_dto):
        tree = (
            Tree()
            .add("root")
            .add("new", "root", 1, state=ModelState.PROVISION, status=ModelStatus.READY)
            .add("child", "new", 2, state=ModelState.PROVISION, status=ModelStatus.READY)
        )
        service = _make_service(tree)

        nodes = _by_name(
            await service.preview(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto, exclude_ids=[tree.ids["new"]])
        )

        assert nodes["new"].reason == "deselected"
        assert nodes["child"].included

    @pytest.mark.asyncio
    async def test_deselected_busy_resource_does_not_block(self, mock_user_dto):
        tree = Tree().add("root").add("running", "root", 1, status=ModelStatus.IN_PROGRESS)
        service = _make_service(tree)

        nodes = _by_name(
            await service.preview(
                tree.ids["root"], WorkflowAction.APPLY, mock_user_dto, exclude_ids=[tree.ids["running"]]
            )
        )

        assert nodes["running"].reason == "deselected"
        assert nodes["root"].included

    @pytest.mark.asyncio
    async def test_everything_deselected_is_nothing_to_run(self, mock_user_dto):
        tree = Tree().add("root")
        service = _make_service(tree)

        with pytest.raises(EntityWrongState, match="Nothing to plan"):
            await service.create_workflow(
                tree.ids["root"], WorkflowAction.PLAN, mock_user_dto, exclude_ids=[tree.ids["root"]]
            )

    @pytest.mark.asyncio
    async def test_excluding_a_resource_outside_the_tree_is_rejected(self, mock_user_dto):
        tree = Tree().add("root")
        service = _make_service(tree)

        with pytest.raises(EntityNotFound, match="not in the tree"):
            await service.preview(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto, exclude_ids=[uuid4()])

    @pytest.mark.asyncio
    async def test_oversized_tree_is_rejected(self, mock_user_dto):
        tree = Tree().add("root")
        service = _make_service(tree)
        tree.rows.extend(tree.rows[0] for _ in range(MAX_TREE_ROWS))

        with pytest.raises(EntityWrongState, match="too large"):
            await service.preview(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto)


class TestRawDatabaseValues:
    """get_tree_to_children is raw SQL: state/status come back as stored enum names."""

    @staticmethod
    def _as_stored(tree: Tree) -> Tree:
        for row in tree.rows:
            row["state"] = row["state"].name
            row["status"] = row["status"].name
        return tree

    @pytest.mark.asyncio
    async def test_provisioned_done_resources_are_applied(self, mock_user_dto):
        tree = self._as_stored(Tree().add("root").add("a", "root", 1))
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["root"].included
        assert nodes["a"].included

    @pytest.mark.asyncio
    async def test_skip_rules_still_apply(self, mock_user_dto):
        tree = self._as_stored(
            Tree()
            .add("root")
            .add("pending", "root", 1, status=ModelStatus.APPROVAL_PENDING)
            .add("gone", "root", 1, state=ModelState.DESTROYED)
        )
        service = _make_service(tree)

        nodes = _by_name(await service.preview(tree.ids["root"], WorkflowAction.APPLY, mock_user_dto))

        assert nodes["pending"].reason == "waiting for approval"
        assert nodes["gone"].reason == "destroyed"

    @pytest.mark.asyncio
    async def test_busy_resource_is_detected(self, mock_user_dto):
        tree = self._as_stored(Tree().add("root").add("running", "root", 1, status=ModelStatus.IN_PROGRESS))
        service = _make_service(tree)

        with pytest.raises(EntityWrongState):
            await service.preview(tree.ids["root"], WorkflowAction.PLAN, mock_user_dto)
