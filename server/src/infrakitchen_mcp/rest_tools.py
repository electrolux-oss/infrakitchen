from dataclasses import dataclass
from typing import Any

import httpx

from fastmcp import FastMCP

from .context import request_auth_token


@dataclass(frozen=True)
class EntityWrites:
    """Definition of the create + patch tools for one entity type."""

    name: str
    path: str
    create_hint: str = ""
    patch_hint: str = ""


ENTITIES: list[EntityWrites] = [
    EntityWrites(
        name="resource",
        path="/api/resources",
        create_hint=(
            "Resources are created in the `provision` state. With the approval flow enabled "
            "(default) the new resource lands in `approval_pending` and waits for a human to "
            "approve before any cloud infrastructure is provisioned — this tool will not bypass "
            "that gate. Required: `name`, `template_id`. Most resources also need "
            "`source_code_version_id`, `parents`, and `variables` (see the template's source "
            "code version for the variable schema)."
        ),
        patch_hint=(
            "If the resource is `approval_pending`/`provision` the patch is applied to the "
            "pending revision; otherwise it is staged as a temp state pending human approval. "
            "Either way, this stays on the safe side of the approval gate."
        ),
    ),
    EntityWrites(
        name="template",
        path="/api/templates",
        create_hint=(
            "Templates are the IaC definitions developers consume. Use the GraphQL "
            "`get_schema TemplateType` to discover required fields. Templates can be abstract "
            "(grouping only) or concrete (backed by a source code version)."
        ),
    ),
    EntityWrites(
        name="source_code",
        path="/api/source_codes",
        create_hint=(
            "A source code is a pointer to a git repo / IaC module location. "
            "`source_code_versions` are then created against it to pin a specific "
            "branch/tag/folder."
        ),
    ),
    EntityWrites(
        name="source_code_version",
        path="/api/source_code_versions",
        create_hint=(
            "Pins a specific version (branch/tag, folder) of a `source_code` and is what a "
            "concrete template instantiates."
        ),
    ),
    EntityWrites(
        name="storage",
        path="/api/storages",
        create_hint="Configures a Terraform/OpenTofu state backend that resources can store state in.",
    ),
]


def register_rest_write_tools(mcp: FastMCP, client: httpx.AsyncClient) -> None:
    """Register create + patch tools for every entity in `ENTITIES`.

    Each entity gets two tools — `create_<name>` and `patch_<name>` — proxying the
    REST endpoints at `<path>` and `<path>/{id}`. None of these tools approve,
    destroy, or delete; lifecycle actions remain a human responsibility.
    """
    for entity in ENTITIES:
        _register_create(mcp, client, entity)
        _register_patch(mcp, client, entity)


def _register_create(mcp: FastMCP, client: httpx.AsyncClient, entity: EntityWrites) -> None:
    description = (
        f"Create a new {entity.name}. "
        f"Use the GraphQL discovery tools (`get_schema`) to find the field shape. "
        f"{entity.create_hint}"
    ).strip()

    async def create(body: dict[str, Any]) -> dict[str, Any]:
        return await _post(client, entity.path, body)

    mcp.tool(name=f"create_{entity.name}", description=description)(create)


def _register_patch(mcp: FastMCP, client: httpx.AsyncClient, entity: EntityWrites) -> None:
    description = (
        f"Update fields on an existing {entity.name}. At least one field must be provided. {entity.patch_hint}"
    ).strip()

    async def patch(entity_id: str, body: dict[str, Any]) -> dict[str, Any]:
        if not body:
            raise ValueError("`body` must contain at least one field to update.")
        return await _patch(client, f"{entity.path}/{entity_id}", body)

    mcp.tool(name=f"patch_{entity.name}", description=description)(patch)


async def _post(client: httpx.AsyncClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(path, json=body, headers=_auth_headers())
    return _handle_response(response)


async def _patch(client: httpx.AsyncClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.patch(path, json=body, headers=_auth_headers())
    return _handle_response(response)


def _auth_headers() -> dict[str, str]:
    auth = request_auth_token.get(None)
    return {"Authorization": auth} if auth else {}


def _handle_response(response: httpx.Response) -> dict[str, Any]:
    if response.is_success:
        return response.json()

    try:
        detail = response.json()
    except ValueError:
        detail = response.text
    raise ValueError(f"Request failed with status {response.status_code}: {detail}")
