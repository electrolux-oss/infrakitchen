from decimal import Decimal
from typing import Any
from uuid import uuid4
import pytest

from application.projects.model import Project
from application.resources.functions import (
    build_resource_audit_snapshot,
    check_required_variables,
    check_unique_variables,
    check_variable_type,
    get_merged_dependency_config_with_project,
    get_merged_tags_with_project,
    validate_resource_variables_on_create,
    update_resource_variables_on_patch,
)
from application.resources.model import Resource
from application.resources.schema import (
    DependencyConfig,
    DependencyTag,
    ResourceCreate,
    ResourceUpdate,
    ResourceVariableSchema,
    Variables,
)
from application.source_code_versions.model import SourceCodeVersion
from application.templates.model import Template
from application.validation_rules.model import ValidationRuleTargetType
from application.validation_rules.schema import ValidationRuleResponse
from application.workspaces.model import Workspace
from core.constants.model import ModelState, ModelStatus


def test_get_merged_tags_with_project_uses_project_as_default(many_resource_response):
    merged_tags = get_merged_tags_with_project(
        [many_resource_response[0], many_resource_response[1]],
        [DependencyTag(name="shared", value="project", inherited_by_children=True)],
    )

    assert merged_tags["shared"] == "project"
    assert merged_tags["DependencyTag0"] == "value0"
    assert merged_tags["DependencyTagResTwo0"] == "value0"


def test_get_merged_dependency_config_with_project_uses_project_as_default(many_resource_response):
    merged_config = get_merged_dependency_config_with_project(
        [many_resource_response[0], many_resource_response[1]],
        [DependencyConfig(name="shared", value="project", inherited_by_children=True)],
    )

    assert merged_config["shared"] == "project"
    assert merged_config["DependencyConfig0"] == "value0"
    assert merged_config["DependencyConfigResTwo0"] == "value0"


@pytest.mark.parametrize(
    "value,type_str,expected",
    [
        # Valid cases
        ("hello", "string", True),
        (123, "number", True),
        (True, "boolean", True),
        (1.23, "float", True),
        ([1, 2, 3], "array", True),
        ({"key": "value"}, "object", True),
        # Invalid cases
        (123, "string", False),
        ("123", "number", False),
        (1, "boolean", False),
        ("1.23", "float", False),
        ("not-a-list", "array", False),
        ("not-a-dict", "object", False),
        ("anything", "unknown", True),  # Unknown types default to True
    ],
)
def test_check_variable_type(value: Any, type_str: str, expected: bool):
    variable = ResourceVariableSchema(name="foo", type=type_str, description="", value=value)
    assert check_variable_type(variable, value) is expected


# -------------------------------
# Tests for check_required_variables
# -------------------------------


@pytest.mark.parametrize(
    "value,type_str",
    [
        ("hello", "string"),
        ([1, 2], "array"),
        ({"key": "value"}, "object"),
        (123, "number"),
        (False, "boolean"),
    ],
)
def test_check_required_variables_valid(value: Any, type_str: str):
    variable = ResourceVariableSchema(name="test", type=type_str, required=True)
    check_required_variables(variable, value)  # Should not raise


def test_check_required_variables_optional_none():
    variable = ResourceVariableSchema(name="optional", type="string", required=False)
    check_required_variables(variable, None)  # Should pass


def test_required_none_raises():
    var = ResourceVariableSchema(name="my_var", type="string", required=True)
    with pytest.raises(ValueError, match=r"Variable 'my_var' is required but not provided."):
        check_required_variables(var, None)


def test_required_empty_string_raises():
    var = ResourceVariableSchema(name="str_var", type="string", required=True)
    with pytest.raises(ValueError, match=r"Variable 'str_var' is required but provided an empty string."):
        check_required_variables(var, "")


def test_required_empty_object_raises():
    var = ResourceVariableSchema(name="obj_var", type="object", required=True)
    with pytest.raises(ValueError, match=r"Variable 'obj_var' is required but provided an empty object."):
        check_required_variables(var, {})


def test_required_empty_array_raises():
    var = ResourceVariableSchema(name="arr_var", type="array", required=True)
    with pytest.raises(ValueError, match=r"Variable 'arr_var' is required but provided an empty array."):
        check_required_variables(var, [])


def test_check_unique_variables_unique_ok(resource_response):
    variable = ResourceVariableSchema(name="foo", type="string", required=True, unique=True)
    value = "bag"
    res1 = resource_response
    res1.variables = [Variables(name="foo", value="bar")]
    res2 = resource_response.model_copy(deep=True)
    res2.variables = [Variables(name="foo", value="baz")]

    resources = [
        res1,
        res2,
    ]

    # Should not raise
    check_unique_variables(variable, value, resources)


def test_check_unique_variables_duplicate_raises(resource_response):
    variable = ResourceVariableSchema(name="foo", type="string", required=True)
    value = "duplicate"
    res1 = resource_response
    res1.variables = [Variables(name="foo", value="duplicate")]
    res2 = resource_response.model_copy(deep=True)
    res2.variables = [Variables(name="foo", value="baz")]

    resources = [
        res1,
        res2,
    ]

    with pytest.raises(
        ValueError,
        match=r"Variable 'foo' with value 'duplicate' must be unique across resources. Found in resource ",
    ):
        check_unique_variables(variable, value, resources)


# -------------------------------
# Tests for validate_resource_variables_on_create
# -------------------------------


@pytest.mark.asyncio
async def test_validate_resource_variables_success(resource_response):
    schema = [
        ResourceVariableSchema(name="env", type="string", required=True, unique=True),
        ResourceVariableSchema(name="replicas", type="number", required=False),
    ]

    resource = ResourceCreate(
        name="TestResource",
        template_id=uuid4(),
        variables=[
            Variables(name="env", value="prod"),
            Variables(name="replicas", value=3),
        ],
    )

    res1 = resource_response
    res1.variables = [Variables(name="env", value="dev"), Variables(name="replicas", value=2)]
    existing = [res1]

    await validate_resource_variables_on_create(schema, resource, existing)


@pytest.mark.asyncio
async def test_validate_resource_variables_nullable_if_not_required():
    schema = [
        ResourceVariableSchema(name="optional_var", type="string", required=False),
    ]

    resource = ResourceCreate(
        name="TestResource",
        template_id=uuid4(),
        variables=[
            Variables(name="optional_var", value=None),  # Nullable value
        ],
    )
    existing = []
    await validate_resource_variables_on_create(schema, resource, existing)


@pytest.mark.asyncio
async def test_validate_resource_variables_missing_required():
    schema = [ResourceVariableSchema(name="env", type="string", required=True)]
    resource = ResourceCreate(name="test", template_id=uuid4(), variables=[])  # Missing 'env'

    with pytest.raises(ValueError, match=r"Variable 'env' is missing in the resource."):
        await validate_resource_variables_on_create(schema, resource, [])


@pytest.mark.asyncio
async def test_validate_resource_variables_invalid_type():
    schema = [ResourceVariableSchema(name="replicas", type="number")]
    resource = ResourceCreate(
        name="test", template_id=uuid4(), variables=[Variables(name="replicas", value="not-a-number")]
    )

    with pytest.raises(ValueError, match=r"Variable 'replicas' has an invalid type '<class 'str'>'. Expected number."):
        await validate_resource_variables_on_create(schema, resource, [])


@pytest.mark.asyncio
async def test_validate_resource_variables_duplicate_unique(resource_response):
    schema = [ResourceVariableSchema(name="env", type="string", unique=True)]
    resource = ResourceCreate(name="test", template_id=uuid4(), variables=[Variables(name="env", value="prod")])
    res1 = resource_response
    res1.variables = [Variables(name="env", value="prod")]
    existing = [
        res1,
    ]

    with pytest.raises(ValueError, match=r"Variable 'env' with value 'prod' must be unique"):
        await validate_resource_variables_on_create(schema, resource, existing)


@pytest.mark.asyncio
async def test_validate_resource_variables_options_provided():
    schema = [
        ResourceVariableSchema(
            name="color",
            type="string",
            required=True,
            options=["red", "green", "blue"],
        )
    ]
    resource = ResourceCreate(
        name="test",
        template_id=uuid4(),
        variables=[Variables(name="color", value="yellow")],  # Invalid option
    )

    with pytest.raises(ValueError, match=r"Variable 'color' has an invalid value. Expected one of"):
        await validate_resource_variables_on_create(schema, resource, [])


@pytest.mark.asyncio
async def test_validate_resource_variables_regex_rule_violation():
    schema = [
        ResourceVariableSchema(
            name="env",
            type="string",
            validation_rules=[
                ValidationRuleResponse(
                    id=uuid4(),
                    target_type=ValidationRuleTargetType.STRING,
                    regex_pattern=r"^prod$",
                )
            ],
        )
    ]
    resource = ResourceCreate(name="test", template_id=uuid4(), variables=[Variables(name="env", value="dev")])

    with pytest.raises(ValueError, match=r"does not match required pattern"):
        await validate_resource_variables_on_create(schema, resource, [])


@pytest.mark.asyncio
async def test_validate_resource_variables_max_length_violation():
    schema = [
        ResourceVariableSchema(
            name="token",
            type="string",
            validation_rules=[
                ValidationRuleResponse(
                    id=uuid4(),
                    target_type=ValidationRuleTargetType.STRING,
                    max_length=5,
                )
            ],
        )
    ]
    resource = ResourceCreate(
        name="test",
        template_id=uuid4(),
        variables=[Variables(name="token", value="toolong")],
    )

    with pytest.raises(ValueError, match=r"exceeds maximum length"):
        await validate_resource_variables_on_create(schema, resource, [])


@pytest.mark.asyncio
async def test_validate_resource_variables_numeric_rule_violation():
    schema = [
        ResourceVariableSchema(
            name="replicas",
            type="number",
            validation_rules=[
                ValidationRuleResponse(
                    id=uuid4(),
                    target_type=ValidationRuleTargetType.NUMBER,
                    min_value=Decimal("3"),
                    max_value=Decimal("10"),
                )
            ],
        )
    ]
    resource = ResourceCreate(
        name="test",
        template_id=uuid4(),
        variables=[Variables(name="replicas", value=2)],
    )

    with pytest.raises(ValueError, match=r"below the minimum value"):
        await validate_resource_variables_on_create(schema, resource, [])


# -------------------------------
# Tests for validate_resource_variables_on_update
# -------------------------------


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_success_no_change(resource_response):
    schema = [
        ResourceVariableSchema(name="env", type="string", required=True, frozen=True),
    ]
    old = resource_response
    old.variables = [Variables(name="env", value="prod")]

    update = ResourceUpdate(
        variables=[Variables(name="env", value="prod")]  # same value
    )

    await update_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_success_valid_change(resource_response):
    schema = [
        ResourceVariableSchema(name="replicas", type="number", required=False),
    ]
    old = resource_response
    old.variables = [Variables(name="replicas", value=2)]
    update = ResourceUpdate(variables=[Variables(name="replicas", value=3)])

    await update_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_frozen_change(resource_response):
    schema = [ResourceVariableSchema(name="env", type="string", frozen=True)]
    old = resource_response
    old.variables = [Variables(name="env", value="prod")]
    update = ResourceUpdate(variables=[Variables(name="env", value="staging")])

    with pytest.raises(ValueError, match=r"Variable 'env' is frozen and cannot be changed"):
        await update_resource_variables_on_patch(schema, old, update, allow_frozen_variable_changes=False)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_frozen_change_allowed(resource_response):
    schema = [ResourceVariableSchema(name="env", type="string", frozen=True)]
    old = resource_response
    old.variables = [Variables(name="env", value="prod")]
    update = ResourceUpdate(variables=[Variables(name="env", value="staging")])

    await update_resource_variables_on_patch(
        schema,
        old,
        update,
        allow_frozen_variable_changes=True,
    )


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_invalid_type(resource_response):
    schema = [ResourceVariableSchema(name="replicas", type="number")]
    old = resource_response
    old.variables = [Variables(name="replicas", value=2)]
    update = ResourceUpdate(variables=[Variables(name="replicas", value="wrong-type")])

    with pytest.raises(ValueError, match=r"Variable 'replicas' has an invalid type. Expected number."):
        await update_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_invalid_option(resource_response):
    schema = [ResourceVariableSchema(name="color", type="string", options=["red", "green", "blue"])]
    old = resource_response
    old.variables = [Variables(name="color", value="green")]
    update = ResourceUpdate(variables=[Variables(name="color", value="yellow")])

    with pytest.raises(ValueError, match=r"Variable 'color' has an invalid value. Expected one of"):
        await update_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_enforces_rules(resource_response):
    schema = [
        ResourceVariableSchema(
            name="env",
            type="string",
            validation_rules=[
                ValidationRuleResponse(
                    id=uuid4(),
                    target_type=ValidationRuleTargetType.STRING,
                    regex_pattern=r"^prod$",
                )
            ],
        )
    ]
    old = resource_response
    old.variables = [Variables(name="env", value="staging")]
    update = ResourceUpdate(variables=[Variables(name="env", value="staging")])

    with pytest.raises(ValueError, match=r"does not match required pattern"):
        await update_resource_variables_on_patch(schema, old, update)


def test_build_resource_audit_snapshot_captures_related_entities_without_variable_values():
    template = Template(id=uuid4(), name="AWS Redis")
    source_code_version = SourceCodeVersion(
        id=uuid4(), source_code_folder="redis", source_code_version="v1.2.0", source_code_branch=None
    )
    project = Project(id=uuid4(), name="payments")
    workspace = Workspace(id=uuid4(), name="payments-ws")
    resource = Resource(
        id=uuid4(),
        name="redis-prod",
        description="cache",
        state=ModelState.DESTROYED,
        status=ModelStatus.DONE,
        abstract=False,
        labels=["team-a"],
        revision_number=3,
        variables=[
            {"name": "region", "value": "eu-west-1", "sensitive": False},
            {"name": "password", "value": "super-secret", "sensitive": True},
        ],
        template=template,
        source_code_version=source_code_version,
        project=project,
        workspace=workspace,
    )

    snapshot = build_resource_audit_snapshot(resource)

    assert snapshot["id"] == str(resource.id)
    assert snapshot["name"] == "redis-prod"
    assert snapshot["entityName"] == "resource"
    assert snapshot["state"] == ModelState.DESTROYED
    assert snapshot["status"] == ModelStatus.DONE
    assert snapshot["labels"] == ["team-a"]
    assert snapshot["revisionNumber"] == 3
    assert snapshot["template"] == {"id": str(template.id), "name": "AWS Redis"}
    assert snapshot["templateVersion"] == {
        "id": str(source_code_version.id),
        "name": "redis:v1.2.0",
        "sourceCodeVersion": "v1.2.0",
        "sourceCodeBranch": None,
    }
    assert snapshot["project"] == {"id": str(project.id), "name": "payments"}
    assert snapshot["workspace"] == {"id": str(workspace.id), "name": "payments-ws"}
    assert snapshot["variableNames"] == ["region", "password"]
    assert "super-secret" not in repr(snapshot)
    assert "eu-west-1" not in repr(snapshot)


def test_build_resource_audit_snapshot_uses_branch_when_version_is_missing():
    source_code_version = SourceCodeVersion(
        id=uuid4(), source_code_folder="redis", source_code_version=None, source_code_branch="main"
    )
    resource = Resource(
        id=uuid4(),
        name="redis-dev",
        state=ModelState.PROVISION,
        status=ModelStatus.APPROVAL_PENDING,
        source_code_version=source_code_version,
    )

    snapshot = build_resource_audit_snapshot(resource)

    assert snapshot["templateVersion"]["name"] == "redis:main"
    assert snapshot["template"] is None
    assert snapshot["project"] is None
    assert snapshot["workspace"] is None
    assert snapshot["variableNames"] == []
