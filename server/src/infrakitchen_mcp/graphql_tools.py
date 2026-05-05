from typing import Any

import httpx
from graphql import GraphQLEnumType, GraphQLInputObjectType, GraphQLObjectType, GraphQLSchema, OperationType, parse
from graphql.error import GraphQLSyntaxError
from graphql.utilities import print_type

from fastmcp import FastMCP

from .context import request_auth_token


GRAPHQL_PATH = "/api/graphql"


QUERY_TOOL_DESCRIPTION = """Execute a GraphQL query against the InfraKitchen API.

InfraKitchen exposes its full read API through GraphQL. The schema is large, so
fetch only the type fragments you need:

  1. Call `list_schema_types` once to see all top-level query fields and their
     return types. This is the entry map (~1-3 KB).
  2. Call `get_schema(type_name)` for each object type you plan to read. The
     result includes the type's fields plus any input/enum types it directly
     references, so one call usually gives you everything to query that entity.
  3. Call `graphql_query` with your composed query.

Skip steps 1-2 if the conversation context already contains the schema you
need - this tool does not require schema discovery.

GraphQL field names are camelCase. Filters use Django-style operator suffixes
(e.g. `{state: "error"}`, `{name__like: "%prod%"}`, `{id__in: ["..."]}`).
Pagination is `range: [start, end]` (inclusive), sorting is `sort: ["field", "ASC"]`.
"""

GET_SCHEMA_TOOL_DESCRIPTION = """Return the SDL for a single GraphQL type plus its
directly-referenced input and enum types.

Use this before composing a `graphql_query` if you don't already know the type's
fields. Pass the type name exactly as it appears in `list_schema_types` (e.g.
`ResourceType`, `TemplateType`).
"""

LIST_SCHEMA_TYPES_DESCRIPTION = """List all top-level GraphQL query fields with their
argument and return types. Use this as the entry map for schema discovery, then
drill into specific types with `get_schema`.
"""


def _collect_referenced_type_names(type_: GraphQLObjectType) -> list[str]:
    """Find input/enum types directly referenced by an object type's fields."""
    names: set[str] = set()
    for field in type_.fields.values():
        for arg in field.args.values():
            inner = _unwrap(arg.type)
            if isinstance(inner, (GraphQLInputObjectType, GraphQLEnumType)):
                names.add(inner.name)
    return sorted(names)


def _unwrap(gql_type: Any) -> Any:
    """Strip NonNull/List wrappers to get the underlying named type."""
    while hasattr(gql_type, "of_type"):
        gql_type = gql_type.of_type
    return gql_type


def _format_field_signature(name: str, field: Any) -> str:
    args = ", ".join(f"{arg_name}: {arg.type}" for arg_name, arg in field.args.items())
    if args:
        return f"  {name}({args}): {field.type}"
    return f"  {name}: {field.type}"


def register_graphql_tools(mcp: FastMCP, client: httpx.AsyncClient, schema: GraphQLSchema) -> None:
    """Register the three GraphQL discovery + query tools on the MCP server."""

    @mcp.tool(description=LIST_SCHEMA_TYPES_DESCRIPTION)
    def list_schema_types() -> str:
        query_type = schema.query_type
        if query_type is None:
            return "No queries available."
        lines = ["Top-level query fields:"]
        for name, field in query_type.fields.items():
            lines.append(_format_field_signature(name, field))
        return "\n".join(lines)

    @mcp.tool(description=GET_SCHEMA_TOOL_DESCRIPTION)
    def get_schema(type_name: str) -> str:
        target = schema.get_type(type_name)
        if target is None:
            available = ", ".join(sorted(t for t in schema.type_map if not t.startswith("__")))
            raise ValueError(f"Unknown type '{type_name}'. Available types: {available}")

        sections = [print_type(target)]

        if isinstance(target, GraphQLObjectType):
            for ref_name in _collect_referenced_type_names(target):
                ref = schema.get_type(ref_name)
                if ref is not None:
                    sections.append(print_type(ref))

        return "\n\n".join(sections)

    @mcp.tool(description=QUERY_TOOL_DESCRIPTION)
    async def graphql_query(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            document = parse(query)
        except GraphQLSyntaxError as e:
            raise ValueError(f"Invalid GraphQL syntax: {e.message}") from e

        for definition in document.definitions:
            if getattr(definition, "operation", OperationType.QUERY) is not OperationType.QUERY:
                raise ValueError("Only `query` operations are allowed; mutations and subscriptions are not.")

        headers = {}
        auth = request_auth_token.get(None)
        if auth:
            headers["Authorization"] = auth

        response = await client.post(
            GRAPHQL_PATH,
            json={"query": query, "variables": variables or {}},
            headers=headers,
        )
        response.raise_for_status()
        return response.json()
