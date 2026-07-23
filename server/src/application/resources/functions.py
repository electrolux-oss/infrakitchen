import logging
from collections import defaultdict
from collections.abc import Sequence
import re
from typing import Any, cast
from uuid import UUID


from application.projects.functions import requester_is_project_owner
from application.projects.model import Project
from application.resources.schema import (
    DependencyType,
    ResourceCreate,
    ResourceResponse,
    ResourceVariableSchema,
    ResourceWithConfigs,
    ResourceUpdate,
    Variables,
)
from application.source_code_versions.schema import (
    SourceCodeVersionWithConfigs,
    SourceConfigTemplateReferenceResponse,
)
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import EntityExistsError
from core.notifications.service import SubscriptionService
from core.permissions.schema import ActionLiteral, EntityPolicyCreate
from core.permissions.service import PermissionService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO
from application.validation_rules.model import ValidationRuleTargetType
from application.validation_rules.schema import ValidationRuleResponse
from application.validation_rules.validators import validate_number_rule, validate_string_rule

logger = logging.getLogger(__name__)


async def get_resource_actions(
    requester: UserDTO,
    resource_id: str | UUID,
    status: ModelStatus,
    state: ModelState,
    temp_state_exists: bool,
    project: Project | None = None,
) -> list[str]:
    """
    Get all actions available for the resource.
    Permissions are calculated from both resource-level and project-level policies.
    :param resource_id: ID of the resource
    :param project_id: ID of the project the resource belongs to (optional)
    :return: List of actions
    """

    requester_permissions = await user_entity_permissions(requester, resource_id, "resource")

    # If resource has a project, also check project-level / owner permissions and merge
    if project and ("write" not in requester_permissions and "admin" not in requester_permissions):
        if await requester_is_project_owner(requester, project):
            requester_permissions.append("admin")

        project_permissions = await user_entity_permissions(requester, project.id, "project")
        # Merge: use the highest permission level from either source
        all_permissions = set(requester_permissions) | set(project_permissions)
        requester_permissions = list(all_permissions)

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

    if temp_state_exists:
        actions.append("has_temporary_state")
        actions.append("dryrun_with_temp_state")

    if status == ModelStatus.APPROVAL_PENDING:
        if user_is_admin:
            actions.append(ModelActions.APPROVE)
            actions.append(ModelActions.REJECT)
        actions.append(ModelActions.DRYRUN)
        actions.append(ModelActions.DOWNLOAD)
        actions.append(ModelActions.EDIT)
        if state == ModelState.PROVISION:
            actions.append(ModelActions.DELETE)
    elif status == ModelStatus.REJECTED:
        actions.append(ModelActions.RECREATE)
        if user_is_admin:
            actions.append(ModelActions.DELETE)
    elif state == ModelState.PROVISIONED:
        actions.append(ModelActions.DESTROY)
        actions.append(ModelActions.CASCADE_DESTROY)
        actions.append(ModelActions.EXECUTE)
        actions.append(ModelActions.DOWNLOAD)
        actions.append(ModelActions.EDIT)
        actions.append(ModelActions.DRYRUN)

        if temp_state_exists and user_is_admin:
            actions.append(ModelActions.APPROVE)
            actions.append(ModelActions.REJECT)
    elif state == ModelState.PROVISION:
        actions.append(ModelActions.EXECUTE)
        actions.append(ModelActions.DOWNLOAD)
        actions.append(ModelActions.EDIT)
        if status == ModelStatus.READY:
            actions.append(ModelActions.DRYRUN)
            actions.append(ModelActions.DELETE)
        elif status == ModelStatus.ERROR:
            actions.append(ModelActions.DESTROY)
            actions.append(ModelActions.CASCADE_DESTROY)
            actions.append(ModelActions.DRYRUN)
        if temp_state_exists and user_is_admin:
            actions.append(ModelActions.APPROVE)
            actions.append(ModelActions.REJECT)
    elif state == ModelState.DESTROYED:
        if status == ModelStatus.DONE:
            actions.append(ModelActions.RECREATE)
            if user_is_admin:
                actions.append(ModelActions.DELETE)
    elif state == ModelState.DESTROY:
        if status == ModelStatus.ERROR or status == ModelStatus.READY:
            actions.append(ModelActions.RECREATE)
            actions.append(ModelActions.DOWNLOAD)
            actions.append(ModelActions.EXECUTE)
            actions.append(ModelActions.DRYRUN)

    return actions


def merge_tags_or_configs(tags: Sequence[DependencyType], *args: Sequence[DependencyType]) -> Sequence[DependencyType]:
    result = list(tags).copy()
    for arg in args:
        for tag in arg:
            if tag not in result and tag.inherited_by_children is True:
                result.append(tag)
    return result


def get_merged_dependency_config(parents: list[ResourceWithConfigs]) -> dict[str, Any]:
    parsed_config: dict[str, Any] = {}
    for parent in parents:
        if not parent.dependency_config:
            continue
        dependency_config = [config for config in parent.dependency_config if config.inherited_by_children is True]
        parsed_config.update({config.name: config.value for config in dependency_config if config.value is not None})
    return parsed_config


def get_merged_tags_with_project(
    parents: list[ResourceWithConfigs],
    project_tags: list[Any] | None = None,
) -> dict[str, str]:
    """
    Retrieves and merges tags from the project (lowest priority), then parent resources.
    Project tags act as defaults that parent resource tags can override.

    Args:
        parents: A list of parent resources with their configurations.
        project_tags: Tags from the project (list of DependencyTag-like dicts or objects).

    Returns:
        dict[str, str]: A dictionary containing the merged tags.
    """
    parsed_tags: dict[str, str] = {}

    # Project tags as lowest-priority defaults
    if project_tags:
        for tag in project_tags:
            if hasattr(tag, "inherited_by_children"):
                if tag.inherited_by_children:
                    parsed_tags[tag.name] = tag.value
            elif isinstance(tag, dict):
                if tag.get("inherited_by_children", False):
                    parsed_tags[tag["name"]] = tag["value"]

    # Parent resource tags override project tags
    for parent in parents:
        if not parent.dependency_tags:
            continue
        dependency_tags = [tag for tag in parent.dependency_tags if tag.inherited_by_children is True]
        parsed_tags.update({tag.name: tag.value for tag in dependency_tags})

    return parsed_tags


def get_merged_dependency_config_with_project(
    parents: list[ResourceWithConfigs],
    project_dependency_config: list[Any] | None = None,
) -> dict[str, Any]:
    """
    Retrieves config from the project (lowest priority), then parent resources.
    Project config acts as defaults that parent resource config can override.
    """
    parsed_config: dict[str, Any] = {}

    if project_dependency_config:
        for config in project_dependency_config:
            if hasattr(config, "inherited_by_children"):
                if config.inherited_by_children and config.value is not None:
                    parsed_config[config.name] = config.value
            elif isinstance(config, dict):
                if config.get("inherited_by_children", False) and config.get("value") is not None:
                    parsed_config[config["name"]] = config["value"]

    parsed_config.update(get_merged_dependency_config(parents))
    return parsed_config


async def add_resource_parent_policy(
    resource_id: UUID, parent_ids: list[str | UUID], permission_service: PermissionService, requester: UserDTO
) -> None:
    if not parent_ids:
        return
    policy_filter = {"v1__in": [f"resource:{parent_id}" for parent_id in parent_ids]}
    parent_policies = await permission_service.get_all(filter=policy_filter)

    for parent_policy in parent_policies:
        if parent_policy.v0 is not None and parent_policy.v0.startswith("user:"):
            continue
        policy = EntityPolicyCreate(
            role=parent_policy.v0,
            entity_id=resource_id,
            entity_name="resource",
            action=cast(ActionLiteral, parent_policy.v2),
        )

        try:
            await permission_service.create_entity_policy(policy, requester=requester)
            logger.info(f"Added policy {parent_policy.v0} {resource_id} resource")
        except EntityExistsError as e:
            logger.warning(e)


async def delete_resource_policies(
    resource_id: str | UUID,
    permission_service: PermissionService,
) -> None:
    await permission_service.delete_entity_permissions("resource", resource_id)


async def add_resource_parent_subscriptions(
    resource_id: UUID, parent_ids: list[str | UUID], subscription_service: SubscriptionService, requester: UserDTO
) -> None:
    if not parent_ids:
        return

    subscription_filter = {"entity_id__in": [f"{parent_id}" for parent_id in parent_ids], "entity_type": "resource"}
    parent_subscriptions = await subscription_service.get_all(filter=subscription_filter)
    for parent_subscription in parent_subscriptions:
        await subscription_service.create(
            entity_id=resource_id,
            entity_type="resource",
            user_id=parent_subscription.user_id,
            requester=requester,
        )
        logger.info(f"Added subscription for user {parent_subscription.user_id} to resource {resource_id}")


def get_resource_variable_schema(
    resource_scv: SourceCodeVersionWithConfigs,
    parents: list[ResourceWithConfigs],
    parent_scvs: list[SourceCodeVersionWithConfigs],
    validation_rules_map: dict[str, list[ValidationRuleResponse]] | None = None,
    project_dependency_config: list[Any] | None = None,
) -> list[ResourceVariableSchema]:
    """
    Retrieves the schema for the resource variables.
    Args:
        resource_scv (SourceCodeVersionWithConfigs): The source code version of the resource.
        parents (list[ResourceWithConfigs]): A list of parent resources with their configurations.
        scv_with_configs (list[SourceCodeVersionWithConfigs]): A list of source code versions with their configurations.
        validation_rules_map (dict[str, list[ValidationRuleResponse]] | None):
            Optional map of validation rules keyed by variable name.
    Returns:
        dict[str, Any]: A dictionary containing the schema for the resource variables.
    """
    validation_rules_map = validation_rules_map or {}

    schema: list[ResourceVariableSchema] = [
        ResourceVariableSchema(
            name=scv.name,
            description=scv.description,
            required=scv.required,
            value=scv.default,
            unique=scv.unique,
            sensitive=scv.sensitive,
            restricted=scv.restricted,
            frozen=scv.frozen,
            type=scv.type,
            options=scv.options,
            index=scv.index,
            validation_rules=[rule.model_copy(deep=True) for rule in validation_rules_map.get(scv.name, [])],
        )
        for scv in resource_scv.variable_configs
    ]

    # name / variable index used by both default-setting passes below.
    schema_by_name: dict[str, ResourceVariableSchema] = {v.name: v for v in schema}

    scv_template_references = resource_scv.template_refs

    # Pre-build once: set of template IDs referenced by this SCV.
    ref_template_ids: set[UUID] = {ref.reference_template_id for ref in scv_template_references}

    # Pre-build once: output_config_name -> list[ref] for fast matching.
    refs_by_output: dict[str, list[SourceConfigTemplateReferenceResponse]] = defaultdict(list)
    for ref in scv_template_references:
        refs_by_output[ref.output_config_name].append(ref)

    # Set default values from referenced parent resources.
    for parent in parents:
        if not parent.source_code_version_id:
            continue

        for parent_scv in parent_scvs:
            if parent_scv.template.id not in ref_template_ids:
                continue

            parent_outputs_map: dict[str, Any] = {f"{o.name}_{parent.template_id}": o.value for o in parent.outputs}

            # Only visit output configs whose name has a matching ref.
            for output_config in parent_scv.output_configs:
                for ref in refs_by_output.get(output_config.name, []):
                    output_value = parent_outputs_map.get(f"{ref.output_config_name}_{ref.reference_template_id}")
                    if output_value is not None:
                        variable = schema_by_name.get(ref.input_config_name)
                        if variable is not None:
                            variable.value = output_value

    # set default values from project dependency config first, then parent dependency configs
    config_map = get_merged_dependency_config_with_project(parents, project_dependency_config)
    for variable in schema:
        if variable.name in config_map:
            variable.value = config_map[variable.name]

    return schema


def validate_variable_against_rules(variable_from_schema: ResourceVariableSchema, value: Any) -> None:
    if value is None or not variable_from_schema.validation_rules:
        return

    for rule in variable_from_schema.validation_rules:
        if rule.target_type == ValidationRuleTargetType.STRING:
            validate_string_rule(variable_from_schema, rule, value)
        elif rule.target_type == ValidationRuleTargetType.NUMBER:
            validate_number_rule(variable_from_schema, rule, value)
        else:
            logger.warning(
                "Unknown validation rule target type '%s' for variable '%s'",
                rule.target_type,
                variable_from_schema.name,
            )


# check_required_variables and check_variable_type functions are used to validate the resource variables
def check_required_variables(variable_from_schema: ResourceVariableSchema, value: Any) -> None:
    if variable_from_schema.required and value is None:
        raise ValueError(f"Variable '{variable_from_schema.name}' is required but not provided.")
    if variable_from_schema.type == "string" and value == "":
        raise ValueError(f"Variable '{variable_from_schema.name}' is required but provided an empty string.")
    if variable_from_schema.type == "object" and value == {}:
        raise ValueError(f"Variable '{variable_from_schema.name}' is required but provided an empty object.")
    if variable_from_schema.type == "array" and value == []:
        raise ValueError(f"Variable '{variable_from_schema.name}' is required but provided an empty array.")


def check_variable_type(variable: ResourceVariableSchema, value: Any) -> bool:
    if variable.type == "string":
        return isinstance(value, str)
    elif variable.type == "number":
        return isinstance(value, int)
    elif variable.type == "boolean":
        return isinstance(value, bool)
    elif variable.type == "float":
        return isinstance(value, float)
    elif variable.type == "array":
        return isinstance(value, list)
    elif variable.type == "object":
        return isinstance(value, dict)
    # TODO: Add more types as needed
    return True


def check_options_values(variable_from_schema: ResourceVariableSchema, variable: Variables) -> bool:
    if not variable_from_schema.options:
        return True

    if variable.value not in variable_from_schema.options:
        return False
    return True


def check_unique_variables(
    variable: ResourceVariableSchema, value: Any, templates_resources: list[ResourceResponse]
) -> None:
    for resource in templates_resources:
        for var in resource.variables:
            if var.name == variable.name and var.value == value:
                raise ValueError(
                    f"Variable '{variable.name}' with value '{value}' must be unique across resources. Found in resource {resource.id}."  # noqa: E501
                )


async def validate_resource_variables_on_create(
    schema: list[ResourceVariableSchema], resource: ResourceCreate, templates_resources: list[ResourceResponse]
) -> None:
    """
    Validates the resource variables against the schema.

    Args:
        schema (list[ResourceVariableSchema]): The schema for the resource variables.
        resource (ResourceCreate): The resource being created.
        templates_resources (list[ResourceResponse]): List of existing resources to check for uniqueness.

    Raises:
        ValueError: If a required variable is missing or if a unique variable already exists.
    """
    resource_variables_dict = {v.name: v for v in resource.variables}
    variables: list[Variables] = []

    for variable in schema:
        if variable.sensitive:
            # Sensitive variables are not allowed
            continue

        resource_variable = resource_variables_dict.get(variable.name)

        if variable.restricted:
            # If the variable is restricted, we do not allow changes and keep the original value
            validate_variable_against_rules(variable, variable.value)
            variables.append(
                Variables(
                    name=variable.name,
                    value=variable.value,
                    description=variable.description if variable.description else "",
                    sensitive=variable.sensitive,
                    type=variable.type,
                )
            )
            continue

        if resource_variable is None:
            raise ValueError(f"Variable '{variable.name}' is missing in the resource.")

        resource_variable.type = variable.type
        resource_variable.description = variable.description if variable.description else resource_variable.description
        resource_variable.sensitive = variable.sensitive

        if variable.required:
            check_required_variables(variable, resource_variable.value)
        else:
            # set default value for non-required variables
            if resource_variable.value is None and variable.value is not None:
                resource_variable.value = variable.value

        if check_options_values(variable, resource_variable) is False:
            raise ValueError(
                f"Variable '{variable.name}' has an invalid value. Expected one of {variable.options}, got {resource_variable.value}."  # noqa: E501
            )

        if variable.unique:
            check_unique_variables(variable, resource_variable.value, templates_resources)

        if resource_variable.value is None:
            # TODO: questionable case, should we allow None values here?
            variables.append(resource_variable)
            continue

        if check_variable_type(variable, resource_variable.value) is False:
            raise ValueError(
                f"Variable '{variable.name}' has an invalid type '{type(resource_variable.value)}'. Expected {variable.type}."  #  noqa: E501
            )

        validate_variable_against_rules(variable, resource_variable.value)
        variables.append(resource_variable)

    resource.variables = variables


async def update_resource_variables_on_patch(
    schema: list[ResourceVariableSchema],
    resource: ResourceResponse,
    patched_resource: ResourceUpdate,
    allow_frozen_variable_changes: bool = False,
) -> None:
    """
    Validates the resource variables against the schema for updates.

    Args:
        schema (list[ResourceVariableSchema]): The schema for the resource variables.
        resource (ResourceResponse): The resource being updated.
        patched_resource (ResourcePatch): The updated resource data.
        allow_frozen_variable_changes (bool): Whether frozen variables can be changed.

    Raises:
        ValueError: If a required variable is missing or if a unique variable already exists.
    """
    if patched_resource.variables is None:
        return

    variables: list[Variables] = []
    resource_variables_dict = {v.name: v for v in resource.variables}
    patched_variables_dict = {v.name: v for v in patched_resource.variables}

    for variable in schema:
        if variable.sensitive:
            # Sensitive variables are not allowed
            continue

        patched_variable = patched_variables_dict.get(variable.name)
        resource_variable = resource_variables_dict.get(variable.name)

        if patched_variable is None:
            raise ValueError(f"Variable '{variable.name}' is missing in the patched resource.")

        patched_variable.description = variable.description if variable.description else patched_variable.description
        patched_variable.type = variable.type
        patched_variable.sensitive = variable.sensitive

        if variable.restricted:
            # If the variable is restricted, we do not allow changes and keep the original value
            validate_variable_against_rules(variable, variable.value)
            variables.append(
                Variables(
                    name=variable.name,
                    value=variable.value,
                    description=variable.description if variable.description else "",
                    sensitive=variable.sensitive,
                    type=variable.type,
                )
            )
            continue

        if variable.required:
            check_required_variables(variable, patched_variable.value)

        if resource_variable:
            # ensure type and description are preserved
            resource_variable.type = variable.type
            resource_variable.description = (
                variable.description if variable.description else resource_variable.description
            )
            resource_variable.sensitive = variable.sensitive

            if resource_variable.value == patched_variable.value:
                # If the variable value hasn't changed, ensure it still satisfies constraints
                if check_options_values(variable, patched_variable) is False:
                    raise ValueError(
                        f"Variable '{variable.name}' has an invalid value. Resource options could be changed in version config"  # noqa: E501
                    )
                validate_variable_against_rules(variable, resource_variable.value)
                variables.append(resource_variable)
                continue

            # If the variable exists in the original resource, we need to check if it's frozen
            if (
                variable.frozen
                and not allow_frozen_variable_changes
                and resource_variable.value != patched_variable.value
            ):
                raise ValueError(f"Variable '{variable.name}' is frozen and cannot be changed.")

        if check_options_values(variable, patched_variable) is False:
            raise ValueError(
                f"Variable '{variable.name}' has an invalid value. Expected one of {variable.options}, got {patched_variable.value}."  # noqa: E501
            )

        if check_variable_type(variable, patched_variable.value) is False:
            raise ValueError(f"Variable '{variable.name}' has an invalid type. Expected {variable.type}.")

        validate_variable_against_rules(variable, patched_variable.value)
        variables.append(patched_variable)

    patched_resource.variables = variables


async def convert_field_by_naming_convention_pattern(
    resource: ResourceCreate, fields: list[str] | None = None, parents: list[ResourceWithConfigs] | None = None
) -> None:
    """
    Converts the specified fields of the resource by replacing variables in the naming convention pattern
    with their actual values.

    Args:
        resource (ResourceCreate): Resource object.
        fields (list[str]): List of field names to convert.
        parents (list[ResourceWithConfigs]): List of parent resources to use for variable replacement.
    """
    if not fields:
        fields = ["name"]

    for field in fields:
        resource_field_value = getattr(resource, field, None)
        if not resource_field_value or not isinstance(resource_field_value, str):
            continue

        if "{" not in resource_field_value and "}" not in resource_field_value:
            continue

        if resource_field_value.count("{") != resource_field_value.count("}"):
            raise ValueError("Invalid name pattern: mismatched braces.")

        matches = re.findall(r"\{([^}]+)\}", resource_field_value)
        for var in resource.variables:
            if var.name in matches:
                resource_field_value = resource_field_value.replace(f"{{{var.name}}}", str(var.value))

        if "{" in resource_field_value or "}" in resource_field_value:
            for parent in parents or []:
                for var in parent.outputs:
                    if var.name in resource_field_value:
                        resource_field_value = resource_field_value.replace(f"{{{var.name}}}", str(var.value))

        if "{" in resource_field_value or "}" in resource_field_value:
            for parent in parents or []:
                for var in parent.dependency_config or []:
                    if var.name in resource_field_value:
                        resource_field_value = resource_field_value.replace(f"{{{var.name}}}", str(var.value))

        # validate that after conversion, there are no unreplaced variables left in the fields
        if "{" in resource_field_value or "}" in resource_field_value:
            matches = re.findall(r"\{([^}]+)\}", resource_field_value)
            raise ValueError(
                f"Invalid name pattern: unreplaced variable in field '{field}'. "
                f"Unreplaced variables: {', '.join(matches)}"
            )

        setattr(resource, field, resource_field_value)
