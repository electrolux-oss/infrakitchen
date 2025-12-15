from collections import defaultdict
import logging
from typing import Any, Literal
from uuid import UUID, uuid4

from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from core.database import to_dict
from core.errors import DependencyError, EntityWrongState, EntityNotFound
from core.revisions.handler import RevisionHandler
from core.users.functions import user_api_permission
from core.utils.event_sender import EventSender
from .crud import TemplateCRUD
from .schema import TemplateCreate, TemplateResponse, TemplateShort, TemplateTreeResponse, TemplateUpdate
from core.users.model import UserDTO

from core.constants import ModelStatus

logger = logging.getLogger(__name__)


class TemplateService:
    """
    TemplateService implements all required business-logic. It uses additional services and utils as helpers
    e.g. TemplateCRUD for crud operations, RevisionHandler for handling revisions, EventSender to send an event, etc
    """

    def __init__(
        self,
        crud: TemplateCRUD,
        revision_handler: RevisionHandler,
        event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.crud: TemplateCRUD = crud
        self.revision_handler: RevisionHandler = revision_handler
        self.event_sender: EventSender = event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get_by_id(self, template_id: str | UUID) -> TemplateResponse | None:
        template = await self.crud.get_by_id(template_id)
        if template is None:
            return None
        return TemplateResponse.model_validate(template)

    async def get_all(self, **kwargs) -> list[TemplateResponse]:
        templates = await self.crud.get_all(**kwargs)
        return [TemplateResponse.model_validate(template) for template in templates]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(self, template: TemplateCreate, requester: UserDTO) -> TemplateResponse:
        """
        Create a new template.
        :param template: TemplateCreate to create
        :param requester: User who creates the template
        :return: Created template
        """
        body = template.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        if set(body.get("parents", [])) & set(body.get("children", [])):
            raise ValueError("A template cannot be both a parent and a child of another template")

        if body.get("parents", []):
            parents = await self.get_all(filter={"id": body["parents"]})
            for parent in parents:
                if parent.status == ModelStatus.DISABLED:
                    raise DependencyError(
                        "A template cannot have a disabled parent template",
                        metadata=[p.model_dump() for p in parents if p.status == ModelStatus.DISABLED],
                    )

        if body.get("children", []):
            children = await self.get_all(filter={"id": body["children"]})
            for child in children:
                if child.status == ModelStatus.DISABLED:
                    raise DependencyError(
                        "A template cannot have a disabled child template",
                        metadata=[c.model_dump() for c in children if c.status == ModelStatus.DISABLED],
                    )

        new_template = await self.crud.create(body)
        new_template.status = ModelStatus.ENABLED
        result = await self.crud.get_by_id(new_template.id)

        await self.revision_handler.handle_revision(new_template)
        await self.audit_log_handler.create_log(new_template.id, requester.id, ModelActions.CREATE)
        response = TemplateResponse.model_validate(result)
        await self.event_sender.send_event(response, ModelActions.CREATE)
        return response

    async def update(self, template_id: str, template: TemplateUpdate, requester: UserDTO) -> TemplateResponse:
        """
        Update an existing template.
        :param template_id: ID of the template to update
        :param template: Template to update
        :param requester: User who updates the template
        :return: Updated template
        """
        body = template.model_dump(exclude_unset=True)
        existing_template = await self.crud.get_by_id(template_id)

        if not existing_template:
            raise EntityNotFound("Template not found")

        if set(body.get("parents", [])) & set(body.get("children", [])):
            raise ValueError("A template cannot be both a parent and a child of another template")

        self.revision_handler.original_entity_instance_dump = to_dict(existing_template)

        if existing_template.status == ModelStatus.DISABLED:
            # If the template is disabled, we can move it back
            existing_template.status = ModelStatus.ENABLED

        await self.audit_log_handler.create_log(template_id, requester.id, ModelActions.UPDATE)
        await self.crud.update(existing_template, body)

        await self.revision_handler.handle_revision(existing_template)
        await self.crud.refresh(existing_template)
        response = TemplateResponse.model_validate(existing_template)
        await self.event_sender.send_event(response, ModelActions.UPDATE)
        return response

    async def patch(self, template_id: str, body: PatchBodyModel, requester: UserDTO) -> TemplateResponse:
        """
        Patch an existing template.
        :param template_id: ID of the template to patch
        :param body: PatchBodyModel to patch
        :param requester: User who patches the template
        :return: Patched template
        """
        existing_template = await self.crud.get_by_id(template_id)
        if not existing_template:
            raise EntityNotFound("Template not found")

        match body.action:
            case ModelActions.DISABLE:
                existing_template.status = ModelStatus.DISABLED
            case ModelActions.ENABLE:
                if existing_template.status == ModelStatus.DISABLED:
                    existing_template.status = ModelStatus.ENABLED
                else:
                    raise EntityWrongState("Template is already enabled")
            case _:
                raise ValueError("Invalid action")

        await self.audit_log_handler.create_log(existing_template.id, requester.id, body.action)
        response = TemplateResponse.model_validate(existing_template)
        await self.event_sender.send_event(response, body.action)
        return response

    async def delete(self, template_id: str, requester: UserDTO) -> None:
        existing_template = await self.crud.get_by_id(template_id)
        if not existing_template:
            raise EntityNotFound("Template not found")

        if existing_template.status == ModelStatus.ENABLED:
            raise EntityWrongState("Template must be disabled before deletion")

        if existing_template.children:
            raise DependencyError(
                message="Cannot delete a template that has children",
                metadata=[TemplateShort.model_validate(child).model_dump() for child in existing_template.children],
            )

        dependencies = await self.crud.get_dependencies(existing_template)
        dependencies_to_raise = []
        if dependencies:
            for dependency in dependencies:
                dependencies_to_raise.append(
                    {
                        "id": dependency.id,
                        "name": dependency.name,
                        "_entity_name": dependency.type,
                    }
                )

        if dependencies_to_raise:
            raise DependencyError(
                message=f"Cannot delete template, it is used by {len(dependencies_to_raise)} entities",
                metadata=dependencies_to_raise,
            )

        await self.audit_log_handler.create_log(template_id, requester.id, ModelActions.DELETE)
        await self.revision_handler.delete_revisions(template_id)
        await self.crud.delete(existing_template)

    async def get_tree(
        self, template_id: str, direction: Literal["parents", "children"] = "children"
    ) -> TemplateTreeResponse | None:
        if direction == "parents":
            tree = await self.crud.get_tree_to_parent(template_id)
        else:
            tree = await self.crud.get_tree_to_children(template_id)

        if not tree:
            raise EntityNotFound("Template not found")

        root = None
        node_map = {}
        children_map = defaultdict(list)
        # First pass: wrap raw dicts into Pydantic nodes and map by ID
        for raw_node in tree:
            node = TemplateTreeResponse(
                id=raw_node["id"],
                node_id=uuid4(),
                name=raw_node["name"],
                status=raw_node["status"],
                children=[],
            )

            parent_id: str | None = None
            if direction == "parents":
                parent_id = raw_node["parent_id"]
            else:
                parent_id = raw_node["child_id"]

            node_map[node.id] = node
            if parent_id is None:
                root = node
            else:
                children_map[parent_id].append(node)

        # Second pass: assign children to parents
        for parent_id, children in children_map.items():
            if parent_id in node_map:
                node_map[parent_id].children.extend(children)

        if root is None:
            return None
        return root

    async def get_actions(self, template_id: str, requester: UserDTO) -> list[str]:
        """
        Get all actions available for the template.
        :param template_id: ID of the template
        :return: List of actions
        """
        apis = await user_api_permission(requester, "template")
        if not apis:
            return []
        requester_permissions = [apis["api:template"]]

        if "admin" not in requester_permissions:
            return []

        actions: list[str] = []
        template = await self.crud.get_by_id(template_id)
        if not template:
            raise EntityNotFound("Template not found")

        if template.status == ModelStatus.ENABLED:
            if "admin" in requester_permissions:
                actions.append(ModelActions.EDIT)
                actions.append(ModelActions.DISABLE)
        if template.status == ModelStatus.DISABLED:
            if "admin" in requester_permissions:
                actions.append(ModelActions.DELETE)
                actions.append(ModelActions.ENABLE)

        return actions
