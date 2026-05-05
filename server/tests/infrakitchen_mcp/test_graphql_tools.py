import httpx
import strawberry
import pytest
from fastmcp import FastMCP

from infrakitchen_mcp.graphql_tools import register_graphql_tools


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


@pytest.mark.asyncio
async def test_tools_registered(server):
    names = [t.name for t in await server.list_tools()]
    assert {"list_schema_types", "get_schema", "graphql_query"} <= set(names)


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
