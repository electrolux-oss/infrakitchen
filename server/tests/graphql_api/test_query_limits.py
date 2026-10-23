import pytest

from graphql_api.helpers import MAX_PAGE_SIZE, parse_range
from graphql_api.schema import schema


@pytest.mark.asyncio
async def test_anonymous_introspection_is_rejected():
    result = await schema.execute("{ __schema { queryType { name } } }", context_value={"user": None})

    assert result.errors is not None
    assert "introspection" in result.errors[0].message.lower()


@pytest.mark.asyncio
async def test_authenticated_introspection_is_allowed(mock_user_dto):
    result = await schema.execute("{ __schema { queryType { name } } }", context_value={"user": mock_user_dto})

    assert result.errors is None
    assert result.data == {"__schema": {"queryType": {"name": "Query"}}}


def _nested(field: str, depth: int, leaf: str = "id") -> str:
    query = leaf
    for _ in range(depth):
        query = f"{field} {{ {query} }}"
    return query


@pytest.mark.asyncio
async def test_deep_queries_are_rejected():
    query = '{ resource(id: "00000000-0000-0000-0000-000000000000") { ' + _nested("children", 12) + " } }"
    result = await schema.execute(query, context_value={"user": None})

    assert result.errors is not None
    assert "exceeds maximum operation depth" in result.errors[0].message


@pytest.mark.asyncio
async def test_tree_queries_are_exempt_from_the_depth_limit():
    query = (
        '{ resourceTree(id: "00000000-0000-0000-0000-000000000000", direction: "children") { '
        + _nested("children", 30)
        + " } }"
    )
    result = await schema.execute(query, context_value={"user": None})

    # Fails on authentication, not on validation
    assert result.errors is not None
    assert all("depth" not in error.message for error in result.errors)


@pytest.mark.asyncio
async def test_alias_flood_is_rejected():
    aliases = " ".join(f"a{i}: __typename" for i in range(MAX_PAGE_SIZE + 1))
    result = await schema.execute(f"{{ {aliases} }}", context_value={"user": None})

    assert result.errors is not None
    assert "aliases" in result.errors[0].message.lower()


def test_parse_range_caps_page_size():
    assert parse_range([0, 50]) == (0, 50)
    assert parse_range([100, 100 + MAX_PAGE_SIZE * 10]) == (100, 100 + MAX_PAGE_SIZE)
    assert parse_range(None) is None


@pytest.mark.parametrize("bad_range", [[-1, 10], [10, 5]])
def test_parse_range_rejects_invalid_bounds(bad_range):
    with pytest.raises(ValueError, match="Invalid range"):
        _ = parse_range(bad_range)
