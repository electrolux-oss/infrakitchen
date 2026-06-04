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
      return types. This is the entry map.
   2. Call `get_schema(type_name)` for each object type you plan to read. The
     result includes the type's fields plus any input/enum types it directly
     references. Note: nested output object types (e.g. `Author` referenced by
     a `Book` field) are NOT auto-expanded — call `get_schema` again on those
     types if you need their field definitions.
   3. Call `graphql_query` with your composed query.

Skip steps 1-2 if the conversation context already contains the schema you
need — this tool does not require schema discovery every time.

IMPORTANT: The top-level query field names use camelCase without prefix.
For example, use `resources` (NOT `allResources`), `templates` (NOT
`allTemplates`). Use `list_schema_types` to see the exact field names.

## Filter operators

Filters are passed as a JSON object. Use double-underscore suffixes for operators:
  - `{name: "exact-match"}` — exact equality (default, no suffix)
  - `{name__like: "%substring%"}` — case-insensitive substring match
  - `{id__in: ["uuid1", "uuid2"]}` — value in list
  - `{integration_ids__any: ["uuid"]}` — for relationship collections, matches
    if ANY related record's ID is in the provided list
  - `{labels__contains_all: ["label1"]}` — JSONB array contains all values
  - Nested relationships: `{template__name__like: "%redis%"}` — filter by
    related object's field

## Pagination & sorting

  - `range: [start, end]` — inclusive indices (e.g. `[0, 99]` for first 100)
  - `sort: ["field", "ASC"]` — sort by field ascending or descending
  - Use the corresponding `*Count` query (e.g. `resourcesCount`) to get totals

## Common field-shape gotchas

Some fields have non-obvious shapes. Use `get_schema` to verify before querying:
  - `variables` — scalar JSON, NOT an object with subfields. Select it as a
    leaf: `variables` (correct), NOT `variables { name value }` (wrong).
  - `storage` — a relation, selected as `storage { id name }`. There is no
    top-level `storageId` shortcut field.
  - `integrationIds` — a relation list: `integrationIds { id name }`.
  - `sourceCodeVersion` — a relation: `sourceCodeVersion { id }`.

When in doubt, call `get_schema("ResourceType")` first — it takes one call
and prevents query failures.

## Example queries

Fetch a resource by ID with full detail:
```graphql
{ resource(id: "uuid") {
    id name state status variables
    template { id name slug }
    parents { id name }
    children { id name state template { id name } }
    integrationIds { id name }
    sourceCodeVersion { id }
    storage { id name }
    storagePath
} }
```

List resources with filtering and pagination:
```graphql
{ resources(filter: {template__name__like: "%VPC%"}, range: [0, 50]) {
    id name state template { id name }
} }
```
"""

GET_SCHEMA_TOOL_DESCRIPTION = """Return the SDL for a single GraphQL type plus its
directly-referenced input and enum types.

Use this before composing a `graphql_query` if you don't already know the type's
fields. Pass the type name exactly as it appears in `list_schema_types` (e.g.
`ResourceType`, `TemplateType`).

IMPORTANT: Always call this tool to discover field names and their types before
writing a GraphQL query. Field names use camelCase (e.g. `integrationIds`,
`sourceCodeVersion`), not snake_case, and some fields that look like they should
have subfields are actually scalars (e.g. `variables` is JSON, not an object).
Guessing field shapes without calling this tool is the most common cause of
query errors.
"""

LIST_SCHEMA_TYPES_DESCRIPTION = """List all top-level GraphQL query fields with their
argument and return types. Use this as the entry map for schema discovery, then
drill into specific types with `get_schema`.

IMPORTANT: Field names are lowercase (e.g. `resources`, `templates`,
`integrations`). Do NOT use prefixed names like `allResources` or
`allTemplates` — those do not exist.
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
        body = response.json()

        if isinstance(body, dict) and body.get("errors"):
            messages = []
            for err in body["errors"]:
                msg = err.get("message", "Unknown error")
                path = err.get("path")
                if path:
                    msg = f"{msg} (path: {'.'.join(str(p) for p in path)})"
                messages.append(msg)
            detail = "; ".join(messages)

            # If there's usable partial data, return it alongside the errors
            # so the LLM can work with what's available.
            if body.get("data"):
                return {
                    "data": body["data"],
                    "errors": messages,
                    "_warning": "Partial data returned; some fields may be missing or null due to errors.",
                }

            # No data at all — raise so the MCP client sees a clear failure.
            raise ValueError(f"GraphQL query failed: {detail}")

        return body

    RESOURCE_TREE_DESCRIPTION = """Fetch a resource's full hierarchy as a nested tree in a single call.

Returns the resource with ALL its descendants (children, grandchildren, etc.)
nested under `children`. Each node includes: id, name, state, status,
template_name, and children[].

Use `direction` to control traversal:
  - `"children"` (default) — root is the given resource, tree expands downward
  - `"parents"` — root is the top-most ancestor, tree expands downward to the
    given resource

This is efficient (single database query using a recursive CTE) and handles
cycles safely. Use it when you need the full subtree or parent chain of a
resource. For detailed fields on individual resources (integrations, variables,
source code, etc.), follow up with `graphql_query` on specific resource IDs.
"""

    # TODO: resource_tree currently proxies the deprecated REST endpoint
    # GET /api/resources/{id}/tree/{direction} which uses a recursive CTE.
    # Long-term, this should be replaced with a dedicated GraphQL query
    # (similar to template_tree in graphql_api/modules/template/queries.py).
    @mcp.tool(description=RESOURCE_TREE_DESCRIPTION)
    async def resource_tree(
        resource_id: str,
        direction: str = "children",
    ) -> dict[str, Any]:
        """Fetch a resource's hierarchy via the REST tree endpoint."""
        headers = {}
        auth = request_auth_token.get(None)
        if auth:
            headers["Authorization"] = auth

        if direction not in ("children", "parents"):
            raise ValueError(f"direction must be 'children' or 'parents', got '{direction}'")

        resp = await client.get(
            f"/api/resources/{resource_id}/tree/{direction}",
            headers=headers,
        )
        if resp.status_code == 404:
            return {"error": f"Resource {resource_id} not found"}
        resp.raise_for_status()
        return resp.json()
