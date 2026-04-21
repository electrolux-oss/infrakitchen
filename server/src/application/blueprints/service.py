import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from application.blueprints.model import blueprint_workflows
from application.workflows.schema import WorkflowCreate, WorkflowRequest, WorkflowResponse, WorkflowStepCreate
from application.workflows.service import WorkflowService
from core.audit_logs.handler import AuditLogHandler
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.revisions.handler import RevisionHandler
from core.users.functions import user_api_permission
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .crud import BlueprintCRUD
from .schema import (
    BlueprintCreate,
    BlueprintResponse,
    BlueprintUpdate,
    WiringRule,
)

logger = logging.getLogger(__name__)


class BlueprintService:
    """
    Manages blueprint CRUD and orchestrates blueprint execution.

    Execution flow:
    1. Resolve template dependency order from wiring rules (topological sort)
    2. Create a BlueprintExecution with one step per template
    3. For each step (in order):
       a. Resolve variables: merge defaults + wiring outputs from previous steps + overrides
       b. Create a Resource via the ResourceService
       c. Mark step done / error
    4. Mark execution done / error
    """

    def __init__(
        self,
        crud: BlueprintCRUD,
        workflow_service: WorkflowService,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud = crud
        self.workflow_service = workflow_service
        self.revision_handler = revision_handler
        self.event_sender = event_sender
        self.audit_log_handler = audit_log_handler

    async def get_by_id(self, blueprint_id: str | UUID) -> BlueprintResponse | None:
        blueprint = await self.crud.get_by_id(blueprint_id)
        if blueprint is None:
            return None
        return BlueprintResponse.model_validate(blueprint)

    async def get_all(self, **kwargs) -> list[BlueprintResponse]:
        blueprints = await self.crud.get_all(**kwargs)
        return [BlueprintResponse.model_validate(bp) for bp in blueprints]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, blueprint: BlueprintCreate, requester: UserDTO) -> BlueprintResponse:
        body = blueprint.model_dump(exclude_unset=True)
        body["created_by"] = requester.id

        # Convert wiring rules to plain dicts for JSON storage
        if "wiring" in body:
            body["wiring"] = [w if isinstance(w, dict) else w.model_dump() for w in body["wiring"]]

        new_blueprint = await self.crud.create(body)
        result = await self.crud.get_by_id(new_blueprint.id)

        await self.revision_handler.handle_revision(new_blueprint)
        await self.audit_log_handler.create_log(new_blueprint.id, requester.id, ModelActions.CREATE)
        response = BlueprintResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return response

    async def update(
        self, blueprint_id: str | UUID, blueprint: BlueprintUpdate, requester: UserDTO
    ) -> BlueprintResponse:
        body = blueprint.model_dump(exclude_unset=True)

        if "wiring" in body:
            body["wiring"] = [w if isinstance(w, dict) else w.model_dump() for w in body["wiring"]]

        updated = await self.crud.update(blueprint_id, body)
        if updated is None:
            raise EntityNotFound("Blueprint not found")

        await self.audit_log_handler.create_log(updated.id, requester.id, ModelActions.UPDATE)
        response = BlueprintResponse.model_validate(updated)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def patch(self, blueprint_id: str, body: PatchBodyModel, requester: UserDTO) -> BlueprintResponse:
        """
        Patch an existing blueprint.
        :param blueprint_id: ID of the blueprint to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the blueprint (for audit logging)
        :return: Patched blueprint response
        """
        existing_blueprint = await self.crud.get_by_id(blueprint_id)
        if not existing_blueprint:
            raise EntityNotFound("Blueprint not found")

        await self.audit_log_handler.create_log(existing_blueprint.id, requester.id, body.action)
        match body.action:
            case ModelActions.DISABLE:
                existing_blueprint.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_blueprint.status == ModelStatus.DISABLED:
                    existing_blueprint.status = ModelStatus.ENABLED
                else:
                    raise EntityWrongState("Blueprint is already enabled")
            case _:
                raise ValueError(f"Action {body.action} is not supported")

        response = BlueprintResponse.model_validate(existing_blueprint)
        await self.event_sender.send_event(response, body.action)
        return response

    async def delete(self, blueprint_id: str | UUID, requester: UserDTO) -> None:
        await self.crud.delete(blueprint_id)
        await self.audit_log_handler.create_log(blueprint_id, requester.id, ModelActions.DELETE)

    async def get_actions(self, blueprint_id: str, requester: UserDTO) -> list[str]:
        apis = await user_api_permission(requester, "blueprint")
        if not apis:
            return []
        requester_permissions = [apis["api:blueprint"]]

        if "write" not in requester_permissions and "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        blueprint = await self.crud.get_by_id(blueprint_id)
        if not blueprint:
            raise EntityNotFound("Blueprint not found")

        if blueprint.status == ModelStatus.ENABLED:
            if "admin" in requester_permissions:
                actions.append(ModelActions.EDIT)
                actions.append(ModelActions.DISABLE)
        if blueprint.status == ModelStatus.DISABLED:
            if "admin" in requester_permissions:
                actions.append(ModelActions.DELETE)
                actions.append(ModelActions.ENABLE)

        return actions

    async def create_workflow(
        self,
        blueprint_id: str | UUID,
        request: WorkflowRequest,
        requester: UserDTO,
    ) -> WorkflowResponse:
        """
        Create a BlueprintExecution with steps in topological order.
        """
        blueprint = await self.crud.get_by_id(blueprint_id)
        if blueprint is None:
            raise EntityNotFound("Blueprint not found")

        self._validate_constants(blueprint, request.variable_overrides)

        wiring_rules = [WiringRule(**w) for w in (blueprint.wiring or [])]
        template_ids = [t.id for t in blueprint.templates]

        # Compute execution order via topological sort (returns (tid, level) tuples)
        ordered_templates = self._topological_sort(template_ids, wiring_rules)

        # Build steps
        steps: list[WorkflowStepCreate] = []
        for tid, position in ordered_templates:
            merged_vars = self._resolve_variables_for_step(
                template_id=tid,
                default_variables=blueprint.default_variables or {},
                variable_overrides=request.variable_overrides,
                wiring_rules=wiring_rules,
                completed_outputs={},  # no outputs yet; will be resolved at runtime
            )
            steps.append(
                WorkflowStepCreate(
                    template_id=tid,
                    position=position,
                    resolved_variables=merged_vars,
                    parent_resource_ids=request.parent_overrides.get(str(tid), []),
                    source_code_version_id=request.source_code_version_overrides.get(str(tid)),
                    integration_ids=request.integration_ids,
                    secret_ids=request.secret_ids,
                    storage_id=request.storage_id,
                )
            )

        workflow_create = WorkflowCreate(
            wiring_snapshot=wiring_rules,
            variable_overrides=request.variable_overrides,
            created_by=requester.id,
            steps=steps,
        )

        execution = await self.workflow_service.create(workflow_create.model_dump(mode="json"), requester)

        # Link the workflow to this blueprint via the association table
        _ = await self.crud.session.execute(
            blueprint_workflows.insert().values(blueprint_id=blueprint.id, workflow_id=execution.id)
        )

        return WorkflowResponse.model_validate(execution)

    @staticmethod
    def _validate_constants(blueprint: Any, variable_overrides: dict[str, dict[str, Any]]) -> None:
        """
        Ensure every constant declared in ``blueprint.configuration.constants``
        has a non-empty value supplied through ``variable_overrides`` for each
        of its wired targets (``blueprint.configuration.constant_wires``).
        """
        configuration = blueprint.configuration or {}
        constants = configuration.get("constants") or []
        constant_wires = configuration.get("constant_wires") or []
        if not constants:
            return

        # Group wires by constant id (stored in source_template_id).
        wires_by_constant: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for wire in constant_wires:
            wires_by_constant[str(wire["source_template_id"])].append(wire)

        missing: list[str] = []
        for constant in constants:
            constant_id = str(constant["id"])
            name = constant.get("name") or constant_id
            wires = wires_by_constant.get(constant_id, [])
            if not wires:
                # Constant declared but not wired anywhere — nothing to validate.
                continue
            for wire in wires:
                target_template = str(wire["target_template_id"])
                target_variable = wire["target_variable"]
                value = (variable_overrides.get(target_template) or {}).get(target_variable)
                if value is None or (isinstance(value, str) and value.strip() == ""):
                    missing.append(name)
                    break

        if missing:
            unique = sorted(set(missing))
            raise ValueError(f"Missing required constant values: {', '.join(unique)}")

    @staticmethod
    def _topological_sort(template_ids: list[UUID], wiring_rules: list[WiringRule]) -> list[tuple[UUID, int]]:
        """
        Sort templates so that sources come before targets.
        Returns list of (template_id, position) tuples where position is the
        BFS level — templates at the same level can execute in parallel.
        """
        id_set = set(template_ids)

        # Build adjacency: source → targets
        graph: dict[UUID, set[UUID]] = defaultdict(set)
        in_degree: dict[UUID, int] = {tid: 0 for tid in template_ids}

        for rule in wiring_rules:
            if rule.source_template_id in id_set and rule.target_template_id in id_set:
                if rule.target_template_id not in graph[rule.source_template_id]:
                    graph[rule.source_template_id].add(rule.target_template_id)
                    in_degree[rule.target_template_id] = in_degree.get(rule.target_template_id, 0) + 1

        # Kahn's algorithm with level tracking
        queue = [tid for tid in template_ids if in_degree.get(tid, 0) == 0]
        result: list[tuple[UUID, int]] = []
        level = 0

        while queue:
            next_queue: list[UUID] = []
            for node in queue:
                result.append((node, level))
                for neighbor in graph.get(node, set()):
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_queue.append(neighbor)
            queue = next_queue
            level += 1

        if len(result) != len(template_ids):
            raise ValueError("Circular dependency detected in blueprint wiring")

        return result

    @staticmethod
    def _resolve_variables_for_step(
        template_id: UUID,
        default_variables: dict[str, Any],
        variable_overrides: dict[str, Any],
        wiring_rules: list[WiringRule],
        completed_outputs: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Merge variables for a template step:
        1. Start with blueprint default_variables for this template
        2. Apply wired outputs from completed upstream steps
        3. Apply runtime variable_overrides
        """
        tid_str = str(template_id)

        # 1) Blueprint defaults
        variables: dict[str, Any] = dict(default_variables.get(tid_str, {}))

        # 2) Wired outputs from upstream
        for rule in wiring_rules:
            if str(rule.target_template_id) == tid_str:
                source_outputs = completed_outputs.get(str(rule.source_template_id), {})
                if rule.source_output in source_outputs:
                    variables[rule.target_variable] = source_outputs[rule.source_output]

        # 3) Runtime overrides
        variables.update(variable_overrides.get(tid_str, {}))

        return variables
