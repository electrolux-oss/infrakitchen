import logging
from collections import defaultdict
from collections.abc import Sequence
import re
from typing import Any, cast
from uuid import UUID


from application.resources.schema import (
    DependencyType,
    ResourceCreate,
    ResourceResponse,
    ResourceVariableSchema,
    ResourceWithConfigs,
    ResourcePatch,
    Variables,
)
from application.source_code_versions.schema import (
    SourceCodeVersionWithConfigs,
    SourceConfigTemplateReferenceResponse,
)
from core.errors import EntityExistsError
from core.permissions.schema import ActionLiteral, EntityPolicyCreate
from core.permissions.service import PermissionService
from core.users.model import UserDTO
from application.validation_rules.model import ValidationRuleTargetType
from application.validation_rules.schema import ValidationRuleResponse
from application.validation_rules.validators import validate_number_rule, validate_string_rule

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


def get_resource_variable_schema(
    resource_scv: SourceCodeVersionWithConfigs,
    parents: list[ResourceWithConfigs],
    parent_scvs: list[SourceCodeVersionWithConfigs],
    validation_rules_map: dict[str, list[ValidationRuleResponse]] | None = None,
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

    # set default values from parent dependency configs
    for parent in parents:
        if not parent.dependency_config:
            continue

        config_map: dict[str, Any] = {
            c.name: c.value for c in parent.dependency_config if c.inherited_by_children and c.value is not None
        }
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
    patched_resource: ResourcePatch,
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
            raise ValueError(f"Invalid name pattern: unreplaced variable in field '{field}'.")

        setattr(resource, field, resource_field_value)
