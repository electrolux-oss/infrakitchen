from collections.abc import Sequence
import logging
from typing import Any
from uuid import UUID


from application.resources.schema import (
    DependencyConfig,
    DependencyType,
    Outputs,
    ResourceCreate,
    ResourceResponse,
    ResourceVariableSchema,
    ResourceWithConfigs,
    ResourcePatch,
    Variables,
)
from application.source_code_versions.schema import (
    SourceCodeVersionWithConfigs,
)
from core.casbin.enforcer import CasbinEnforcer
from core.permissions.service import PermissionService

logger = logging.getLogger(__name__)


def merge_tags_or_configs(tags: Sequence[DependencyType], *args: Sequence[DependencyType]) -> Sequence[DependencyType]:
    result = list(tags).copy()
    for arg in args:
        for tag in arg:
            if tag not in result and tag.inherited_by_children is True:
                result.append(tag)
    return result


def get_merged_tags(parents: list[ResourceWithConfigs]) -> dict[str, str]:
    """
    Retrieves and merges the tags from the parent dependencies and the current dependency.

    Args:
        parents (list[ResourceWithConfigs]): A list of parent resources with their configurations.

    Returns:
        dict[str, str]: A dictionary containing the merged tags.

    """
    parsed_tags: dict[str, str] = {}
    for parent in parents:
        if not parent.dependency_tags:
            continue
        dependency_tags = [tag for tag in parent.dependency_tags if tag.inherited_by_children is True]
        parsed_tags.update({tag.name: tag.value for tag in dependency_tags})
    return parsed_tags


async def add_resource_parent_policy(
    resource_id: str | UUID,
    parent_ids: list[str | UUID],
    casbin_enforcer: CasbinEnforcer,
) -> None:
    enforcer = await casbin_enforcer.get_enforcer()

    for parent in parent_ids:
        parent_policies = enforcer.get_filtered_named_policy("p", 1, f"resource:{parent}")
        for parent_policy in parent_policies:
            if parent_policy[0].startswith("user:"):
                continue

            result = await casbin_enforcer.add_casbin_policy(
                parent_policy[0], resource_id, action=parent_policy[2], object_type="resource"
            )
            if result:
                logger.info(f"Added policy {parent_policy[0]} {resource_id} {parent_policy[2]} resource")
            else:
                logger.warning(f"Policy {parent_policy[0]} {resource_id} {parent_policy[2]} resource already exists")


async def delete_resource_policies(
    resource_id: str | UUID,
    permission_service: PermissionService,
) -> None:
    await permission_service.delete_resource_permissions(resource_id)


def get_resource_variable_schema(
    resource_scv: SourceCodeVersionWithConfigs,
    parents: list[ResourceWithConfigs],
    parent_scvs: list[SourceCodeVersionWithConfigs],
) -> list[ResourceVariableSchema]:
    """
    Retrieves the schema for the resource variables.
    Args:
        resource_scv (SourceCodeVersionWithConfigs): The source code version of the resource.
        parents (list[ResourceWithConfigs]): A list of parent resources with their configurations.
        scv_with_configs (list[SourceCodeVersionWithConfigs]): A list of source code versions with their configurations.
    Returns:
        dict[str, Any]: A dictionary containing the schema for the resource variables.
    """

    def set_default_from_parent(
        parent_outputs: list[Outputs],
        output_name: dict[str, str],
        schema: list[ResourceVariableSchema],
    ) -> None:
        parent_output_value = next((output.value for output in parent_outputs if output_name.get(output.name)), None)
        for variable in schema:
            if not variable.reference:
                continue

            if variable.name == output_name.get(variable.reference.name):
                variable.value = parent_output_value

    def set_default_from_parent_dependency_config(
        dependency_configs: list[DependencyConfig],
        schema: list[ResourceVariableSchema],
    ) -> None:
        for variable in schema:
            for config in dependency_configs:
                if config.inherited_by_children is False:
                    continue
                if variable.name == config.name and config.value is not None:
                    variable.value = config.value

    schema: list[ResourceVariableSchema] = []

    # UUID is referenced output id, dict[str, str] is a mapping of output name to variable name
    referenced_variables: dict[UUID, dict[str, str]] = {}
    for scv in resource_scv.variable_configs:
        rvs = ResourceVariableSchema(
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
            reference=scv.reference,
            index=scv.index,
        )
        schema.append(rvs)
        if not scv.reference:
            continue
        referenced_variables[scv.reference.id] = {scv.reference.name: scv.name}

    # set default values from referenced parent resources
    for parent in parents:
        if not parent.source_code_version_id:
            continue
        for parent_scv in parent_scvs:
            if parent.source_code_version_id == parent_scv.id:
                for output in parent_scv.output_configs:
                    if output.id in referenced_variables:
                        set_default_from_parent(parent.outputs, referenced_variables[output.id], schema)

    # set default values from parent dependency configs
    for parent in parents:
        if not parent.dependency_config:
            continue

        set_default_from_parent_dependency_config(parent.dependency_config, schema)

    return schema


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

        variables.append(resource_variable)

    resource.variables = variables


async def update_resource_variables_on_patch(
    schema: list[ResourceVariableSchema],
    resource: ResourceResponse,
    patched_resource: ResourcePatch,
) -> None:
    """
    Validates the resource variables against the schema for updates.

    Args:
        schema (list[ResourceVariableSchema]): The schema for the resource variables.
        resource (ResourceResponse): The resource being updated.
        patched_resource (ResourcePatch): The updated resource data.

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
                # If the variable value hasn't changed, skip validation
                if check_options_values(variable, patched_variable) is False:
                    raise ValueError(
                        f"Variable '{variable.name}' has an invalid value. Resource options could be changed in version config"  # noqa: E501
                    )
                variables.append(resource_variable)
                continue

            # If the variable exists in the original resource, we need to check if it's frozen
            if variable.frozen and resource_variable.value != patched_variable.value:
                raise ValueError(f"Variable '{variable.name}' is frozen and cannot be changed.")

        if check_options_values(variable, patched_variable) is False:
            raise ValueError(
                f"Variable '{variable.name}' has an invalid value. Expected one of {variable.options}, got {patched_variable.value}."  # noqa: E501
            )

        if check_variable_type(variable, patched_variable.value) is False:
            raise ValueError(f"Variable '{variable.name}' has an invalid type. Expected {variable.type}.")

        variables.append(patched_variable)

    patched_resource.variables = variables
