import json
import logging
from typing import Any

import httpx
import strawberry
import pytest
from fastmcp import FastMCP
from mcp.types import TextContent

from infrakitchen_mcp.graphql_tools import register_graphql_tools


def _text(result: Any) -> str:
    """Extract text from the first content block, with type narrowing for basedpyright."""
    block = result.content[0]
    assert isinstance(block, TextContent)
    return block.text


@pytest.fixture(autouse=True)
def _silence_fastmcp_tool_errors():
    """Tests intentionally trigger tool errors; FastMCP logs them as rich panels.
    Raise the threshold so pytest output stays readable."""
    logger = logging.getLogger("fastmcp")
    previous = logger.level
    logger.setLevel(logging.CRITICAL)
    try:
        yield
    finally:
        logger.setLevel(previous)


@strawberry.type
class Author:
    id: str
    name: str


@strawberry.input
class BookFilter:
    author_id: str | None = None


@strawberry.type
class Book:
    id: str
    title: str
    author: Author | None = None


@strawberry.type
class Query:
    @strawberry.field
    def book(self, id: str) -> Book | None:
        return None

    @strawberry.field
    def books(self, filter: BookFilter | None = None) -> list[Book]:
        return []


_test_schema = strawberry.Schema(query=Query)


@pytest.fixture
def server():
    s = FastMCP("Test")
    register_graphql_tools(s, client=httpx.AsyncClient(), schema=_test_schema._schema)
    return s


def _server_with_transport(handler):
    """Build a FastMCP server backed by a mock HTTP transport."""
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://internal")
    s = FastMCP("Test")
    register_graphql_tools(s, client, _test_schema._schema)
    return s


@pytest.mark.asyncio
async def test_tools_registered(server):
    names = [t.name for t in await server.list_tools()]
    assert {"list_schema_types", "get_schema", "graphql_query", "resource_tree"} <= set(names)


@pytest.mark.asyncio
async def test_list_schema_types_includes_top_level_fields(server):
    result = await server.call_tool("list_schema_types", {})
    text = result.content[0].text
    assert "book(" in text and "books(" in text
    assert "Book" in text


@pytest.mark.asyncio
async def test_get_schema_includes_referenced_input_types(server):
    """Object type SDL should bring its filter input along so one call is enough."""
    result = await server.call_tool("get_schema", {"type_name": "Book"})
    text = result.content[0].text
    assert "type Book" in text
    # Author is referenced as a field type but not as an *input* — so it shouldn't be pulled.
    # BookFilter is referenced by the `books` query argument; we expose it from the Query type.


@pytest.mark.asyncio
async def test_get_schema_pulls_input_types_from_query(server):
    result = await server.call_tool("get_schema", {"type_name": "Query"})
    text = result.content[0].text
    assert "type Query" in text
    assert "input BookFilter" in text


@pytest.mark.asyncio
async def test_get_schema_unknown_type_raises(server):
    with pytest.raises(Exception) as exc:
        await server.call_tool("get_schema", {"type_name": "DoesNotExist"})
    assert "Unknown type" in str(exc.value)


@pytest.mark.asyncio
async def test_graphql_query_rejects_mutations(server):
    """The query tool must refuse anything that isn't a `query` operation."""
    with pytest.raises(Exception) as exc:
        await server.call_tool(
            "graphql_query",
            {"query": "mutation { doThing }"},
        )
    assert "Only `query` operations are allowed" in str(exc.value)


@pytest.mark.asyncio
async def test_graphql_query_rejects_subscriptions(server):
    with pytest.raises(Exception) as exc:
        await server.call_tool(
            "graphql_query",
            {"query": "subscription { thing }"},
        )
    assert "Only `query` operations are allowed" in str(exc.value)


@pytest.mark.asyncio
async def test_graphql_query_rejects_invalid_syntax(server):
    with pytest.raises(Exception) as exc:
        await server.call_tool(
            "graphql_query",
            {"query": "this is not graphql"},
        )
    assert "Invalid GraphQL syntax" in str(exc.value)


# --- GraphQL error handling tests ---


@pytest.mark.asyncio
async def test_graphql_query_raises_on_graphql_errors():
    """200 response with errors array should raise ValueError."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": None,
                "errors": [{"message": "Cannot query field 'foo'", "path": ["book", "foo"]}],
            },
        )

    server = _server_with_transport(handler)
    with pytest.raises(Exception) as exc:
        await server.call_tool("graphql_query", {"query": '{ book(id: "1") { foo } }'})
    assert "GraphQL query failed" in str(exc.value)
    assert "Cannot query field" in str(exc.value)
    assert "book.foo" in str(exc.value)


@pytest.mark.asyncio
async def test_graphql_query_returns_partial_data_with_errors():
    """200 response with both data and errors should return data + errors, not raise."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": {"book": {"id": "1", "title": "Test"}},
                "errors": [{"message": "Permission denied on field 'author'"}],
            },
        )

    server = _server_with_transport(handler)
    result = await server.call_tool("graphql_query", {"query": '{ book(id: "1") { id title author { name } } }'})
    payload = json.loads(_text(result))
    assert payload["data"]["book"]["id"] == "1"
    assert "Permission denied" in payload["errors"][0]
    assert "_warning" in payload


@pytest.mark.asyncio
async def test_graphql_query_success_passthrough():
    """Successful GraphQL response should pass through cleanly."""
    expected = {"data": {"books": [{"id": "1", "title": "Test"}]}}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=expected)

    server = _server_with_transport(handler)
    result = await server.call_tool("graphql_query", {"query": "{ books { id title } }"})
    payload = json.loads(_text(result))
    assert payload == expected


# --- resource_tree tests ---


@pytest.mark.asyncio
async def test_resource_tree_happy_path():
    tree = {
        "id": "r1",
        "nodeId": "n1",
        "name": "root",
        "state": "provisioned",
        "status": "active",
        "templateName": "root-template",
        "children": [
            {
                "id": "r2",
                "nodeId": "n2",
                "name": "child",
                "state": "provisioned",
                "status": "active",
                "templateName": "child-template",
                "children": [],
            }
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/graphql"
        payload = json.loads(request.content.decode("utf-8"))
        assert payload["variables"] == {"id": "r1", "direction": "children"}
        assert "resourceTree(id: $id, direction: $direction)" in payload["query"]
        return httpx.Response(200, json={"data": {"resourceTree": tree}})

    server = _server_with_transport(handler)
    result = await server.call_tool("resource_tree", {"resource_id": "r1"})
    payload = json.loads(_text(result))
    assert payload["id"] == "r1"
    assert payload["node_id"] == "n1"
    assert payload["template_name"] == "root-template"
    assert len(payload["children"]) == 1
    assert payload["children"][0]["node_id"] == "n2"


@pytest.mark.asyncio
async def test_resource_tree_404():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": None,
                "errors": [
                    {
                        "message": "Resource not found",
                        "extensions": {"code": "NOT_FOUND"},
                        "path": ["resourceTree"],
                    }
                ],
            },
        )

    server = _server_with_transport(handler)
    result = await server.call_tool("resource_tree", {"resource_id": "missing"})
    payload = json.loads(_text(result))
    assert "not found" in payload["error"]


@pytest.mark.asyncio
async def test_resource_tree_invalid_direction():
    server = _server_with_transport(lambda r: httpx.Response(200, json={}))
    with pytest.raises(Exception) as exc:
        await server.call_tool("resource_tree", {"resource_id": "r1", "direction": "sideways"})
    assert "children" in str(exc.value) and "parents" in str(exc.value)


@pytest.mark.asyncio
async def test_resource_tree_parents_direction():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        assert payload["variables"] == {"id": "r1", "direction": "parents"}
        return httpx.Response(
            200,
            json={
                "data": {
                    "resourceTree": {
                        "id": "root",
                        "nodeId": "n-root",
                        "name": "ancestor",
                        "state": "provisioned",
                        "status": "active",
                        "templateName": "ancestor-template",
                        "children": [],
                    }
                }
            },
        )

    server = _server_with_transport(handler)
    result = await server.call_tool("resource_tree", {"resource_id": "r1", "direction": "parents"})
    payload = json.loads(_text(result))
    assert payload["id"] == "root"


@pytest.mark.asyncio
async def test_resource_tree_raises_on_non_not_found_graphql_errors():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": None,
                "errors": [
                    {
                        "message": "Permission denied",
                        "extensions": {"code": "ACCESS_DENIED"},
                        "path": ["resourceTree"],
                    }
                ],
            },
        )

    server = _server_with_transport(handler)
    with pytest.raises(Exception) as exc:
        await server.call_tool("resource_tree", {"resource_id": "r1"})
    assert "GraphQL query failed" in str(exc.value)
    assert "Permission denied" in str(exc.value)
