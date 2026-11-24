from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from application.projects.functions import merge_project_permissions
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.permissions.service import PermissionService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO

if TYPE_CHECKING:
    from application.executors.model import Executor
    from application.projects.model import Project


RunRefType = Literal["branch", "tag"]


def resolve_run_ref(
    executor: "Executor", source_code_branch: str | None, source_code_version: str | None
) -> tuple[str, RunRefType] | None:
    """
    The git ref a single run should use instead of the executor's configured one.
    None when no ref is given or it is the configured ref, so the run is a normal one.
    The ref must be a branch or tag known to the executor's source code. The known refs are the ones
    stored by the last source code sync, so a ref pushed after it is not found until the next sync.
    """
    if source_code_branch and source_code_version:
        raise ValueError("Only one of source code tag or branch is allowed")
    if source_code_branch:
        if source_code_branch == executor.source_code_branch:
            return None
        if source_code_branch not in (executor.source_code.git_branches or []):
            raise ValueError(
                f"Branch {source_code_branch} not found in the source code, sync the source code if it was just pushed"
            )
        return source_code_branch, "branch"
    if source_code_version:
        if source_code_version == executor.source_code_version:
            return None
        if source_code_version not in (executor.source_code.git_tags or []):
            raise ValueError(
                f"Tag {source_code_version} not found in the source code, sync the source code if it was just pushed"
            )
        return source_code_version, "tag"
    return None


def build_executor_audit_snapshot(executor: "Executor") -> dict[str, Any]:
    """Snapshot stored on the delete audit row: the executor and its revisions are gone afterwards."""
    return {
        "id": str(executor.id),
        "name": executor.name,
        "entityName": "executor",
        "status": executor.status,
        "state": executor.state,
        "description": executor.description,
        "runtime": executor.runtime,
        "labels": list(executor.labels or []),
        "project": {"id": str(executor.project.id), "name": executor.project.name} if executor.project else None,
        "createdAt": executor.created_at.isoformat() if executor.created_at else None,
        "updatedAt": executor.updated_at.isoformat() if executor.updated_at else None,
        "revisionNumber": executor.revision_number,
    }


async def delete_executor_policies(
    executor_id: str | UUID,
    permission_service: PermissionService,
) -> None:
    await permission_service.delete_entity_permissions("executor", executor_id)


async def get_executor_permissions(
    requester: UserDTO, executor_id: str | UUID, project: "Project | None" = None
) -> list[str]:
    """
    The requester's permissions on the executor, as for resources: executor policies merged with the
    policies of the executor's project, and the project owners are executor admins.
    """
    return await merge_project_permissions(
        requester, await user_entity_permissions(requester, executor_id, "executor"), project
    )


async def get_executor_actions(
    requester: UserDTO,
    executor_id: str | UUID,
    status: ModelStatus,
    state: ModelState,
    project: "Project | None" = None,
) -> list[str]:
    """
    Get all actions available for an executor based on user permissions and executor status/state.
    Permissions are calculated from both executor-level and project-level policies.
    """
    requester_permissions = await get_executor_permissions(requester, executor_id, project)
    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status in [ModelStatus.IN_PROGRESS]:
        return []

    user_is_admin = "admin" in requester_permissions

    if status == ModelStatus.QUEUED:
        if user_is_admin:
            actions.append(ModelActions.RETRY)
        return actions

    if state == ModelState.PROVISIONED:
        actions.append(ModelActions.DESTROY)
        actions.append(ModelActions.EXECUTE)
        if user_is_admin:
            actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DRYRUN)

    elif state == ModelState.PROVISION:
        actions.append(ModelActions.EXECUTE)
        if user_is_admin:
            actions.append(ModelActions.EDIT)
        if status == ModelStatus.READY:
            actions.append(ModelActions.DRYRUN)
            actions.append(ModelActions.DELETE)
        elif status == ModelStatus.ERROR:
            actions.append(ModelActions.DESTROY)
            actions.append(ModelActions.DRYRUN)
    elif state == ModelState.DESTROYED:
        if status == ModelStatus.DONE:
            actions.append(ModelActions.RECREATE)
            if user_is_admin:
                actions.append(ModelActions.DELETE)
    elif state == ModelState.DESTROY:
        if status == ModelStatus.ERROR or status == ModelStatus.READY:
            actions.append(ModelActions.RECREATE)
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.DRYRUN)

    return actions
