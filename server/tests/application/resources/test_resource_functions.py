from typing import Any
from uuid import uuid4
import pytest

from application.resources.functions import (
    check_required_variables,
    check_unique_variables,
    check_variable_type,
    validate_resource_variables_on_create,
    validate_resource_variables_on_patch,
)
from application.resources.schema import (
    ResourceCreate,
    ResourcePatch,
    ResourceVariableSchema,
    Variables,
)


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

    with pytest.raises(ValueError, match=r"Variable 'env' is required"):
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

    update = ResourcePatch(
        variables=[Variables(name="env", value="prod")]  # same value
    )

    await validate_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_success_valid_change(resource_response):
    schema = [
        ResourceVariableSchema(name="replicas", type="number", required=False),
    ]
    old = resource_response
    old.variables = [Variables(name="replicas", value=2)]
    update = ResourcePatch(variables=[Variables(name="replicas", value=3)])

    await validate_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_frozen_change(resource_response):
    schema = [ResourceVariableSchema(name="env", type="string", frozen=True)]
    old = resource_response
    old.variables = [Variables(name="env", value="prod")]
    update = ResourcePatch(variables=[Variables(name="env", value="staging")])

    with pytest.raises(ValueError, match=r"Variable 'env' is frozen and cannot be changed"):
        await validate_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_invalid_type(resource_response):
    schema = [ResourceVariableSchema(name="replicas", type="number")]
    old = resource_response
    old.variables = [Variables(name="replicas", value=2)]
    update = ResourcePatch(variables=[Variables(name="replicas", value="wrong-type")])

    with pytest.raises(ValueError, match=r"Variable 'replicas' has an invalid type. Expected number."):
        await validate_resource_variables_on_patch(schema, old, update)


@pytest.mark.asyncio
async def test_validate_resource_variables_patch_invalid_option(resource_response):
    schema = [ResourceVariableSchema(name="color", type="string", options=["red", "green", "blue"])]
    old = resource_response
    old.variables = [Variables(name="color", value="green")]
    update = ResourcePatch(variables=[Variables(name="color", value="yellow")])

    with pytest.raises(ValueError, match=r"Variable 'color' has an invalid value. Expected one of"):
        await validate_resource_variables_on_patch(schema, old, update)
