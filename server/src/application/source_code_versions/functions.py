from typing import Any

from application.source_code_versions.schema import SourceOutputConfigResponse, SourceOutputConfigTemplateResponse
from core.constants.model import ModelActions, ModelStatus
from core.users.functions import user_api_permission
from core.users.model import UserDTO


def verify_config_type(config: dict[str, Any], expected_type: str) -> None:
    """
    Verify that the config dictionary has the expected type.

    Args:
        config (dict[str, Any]): The configuration dictionary to verify.
        expected_type (str): The expected type of the configuration.
    """
    if not config.get("default"):
        return

    match expected_type:
        case "number":
            config["default"] = int(config["default"])
        case "boolean":
            config["default"] = bool(config["default"])
        case "string":
            config["default"] = str(config["default"])
        case _:
            pass


def filter_template_outputs(outputs: list[SourceOutputConfigResponse]) -> list[SourceOutputConfigTemplateResponse]:
    """
    Filter the output configurations to include only one per unique name.

    Args:
        outputs (list[SourceOutputConfigResponse]): The list of output configurations.
    Returns:
        list[SourceOutputConfigTemplateResponse]: The filtered list of template output configurations.
    """
    # TODO: Check for missed outputs in the template and mark them as "deleted"
    template_outputs_dict: dict[str, tuple[SourceOutputConfigTemplateResponse, int]] = {}
    for output in outputs:
        if template_outputs_dict.get(output.name) is None:
            template_output = SourceOutputConfigTemplateResponse(
                name=output.name,
                description=output.description,
                created_at=output.created_at,
                updated_at=output.updated_at,
                status="new",
            )
            template_outputs_dict[output.name] = (template_output, 0)
        else:
            current_output, current_count = template_outputs_dict[output.name]
            template_outputs_dict[output.name] = (
                current_output,
                current_count + 1,
            )

    for output, count in template_outputs_dict.values():
        if count >= 1:
            output.status = "active"

    return [t[0] for t in template_outputs_dict.values()]


async def get_source_code_version_actions(requester: UserDTO, status: ModelStatus) -> list[str]:
    """Get all actions available for a source code version based on user permissions and status."""
    apis = await user_api_permission(requester, "source_code_version")
    if not apis:
        return []
    requester_permissions = [apis["api:source_code_version"]]

    if "write" not in requester_permissions and "admin" not in requester_permissions:
        return []

    if "admin" not in requester_permissions:
        return []

    actions: list[str] = []

    if status == ModelStatus.IN_PROGRESS:
        return []

    if status in [ModelStatus.READY, ModelStatus.ERROR, ModelStatus.DONE]:
        actions.append("sync")
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DISABLE)
        return actions

    if status == ModelStatus.DISABLED:
        actions.append(ModelActions.ENABLE)
        actions.append(ModelActions.DELETE)
        return actions

    return actions
