import json
import logging

import httpx
import pytest
from fastmcp import FastMCP
from mcp.types import TextContent

from infrakitchen_mcp.context import request_auth_token
from infrakitchen_mcp.rest_tools import ENTITIES, register_rest_write_tools


@pytest.fixture(autouse=True)
def _silence_fastmcp_tool_errors():
    logger = logging.getLogger("fastmcp")
    previous = logger.level
    logger.setLevel(logging.CRITICAL)
    try:
        yield
    finally:
        logger.setLevel(previous)


def _build_server(handler):
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://internal")
    server = FastMCP("Test")
    register_rest_write_tools(server, client)
    return server


@pytest.mark.asyncio
async def test_every_entity_gets_create_and_patch_tool():
    server = _build_server(lambda req: httpx.Response(200, json={}))
    names = {t.name for t in await server.list_tools()}
    for entity in ENTITIES:
        assert f"create_{entity.name}" in names
        assert f"patch_{entity.name}" in names


@pytest.mark.asyncio
async def test_create_resource_posts_to_resources_endpoint():
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        captured["auth"] = request.headers.get("Authorization")
        return httpx.Response(
            201,
            json={"id": "abc", "status": "approval_pending", "state": "provision"},
        )

    server = _build_server(handler)
    token = request_auth_token.set("Bearer test-token")
    try:
        result = await server.call_tool(
            "create_resource",
            {"body": {"name": "my-bucket", "template_id": "tmpl-1"}},
        )
    finally:
        request_auth_token.reset(token)

    assert captured["method"] == "POST"
    assert captured["path"] == "/api/resources"
    assert captured["body"] == {"name": "my-bucket", "template_id": "tmpl-1"}
    assert captured["auth"] == "Bearer test-token"
    block = result.content[0]
    assert isinstance(block, TextContent)
    payload = json.loads(block.text)
    assert payload["status"] == "approval_pending"


@pytest.mark.asyncio
async def test_patch_resource_patches_to_resource_endpoint():
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "abc", "description": "updated"})

    server = _build_server(handler)
    await server.call_tool(
        "patch_resource",
        {"entity_id": "abc", "body": {"description": "updated"}},
    )

    assert captured["method"] == "PATCH"
    assert captured["path"] == "/api/resources/abc"
    assert captured["body"] == {"description": "updated"}


@pytest.mark.asyncio
async def test_patch_rejects_empty_body():
    server = _build_server(lambda req: httpx.Response(200, json={}))
    with pytest.raises(Exception) as exc:
        await server.call_tool("patch_resource", {"entity_id": "abc", "body": {}})
    assert "at least one field" in str(exc.value)


@pytest.mark.asyncio
async def test_create_resource_surfaces_backend_errors():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"detail": "Access denied"})

    server = _build_server(handler)
    with pytest.raises(Exception) as exc:
        await server.call_tool(
            "create_resource",
            {"body": {"name": "x", "template_id": "tmpl-1"}},
        )
    assert "403" in str(exc.value)
    assert "Access denied" in str(exc.value)


@pytest.mark.asyncio
async def test_create_template_hits_correct_path():
    """Smoke-check that the helper routes a non-resource entity correctly."""
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(201, json={"id": "tmpl-1"})

    server = _build_server(handler)
    await server.call_tool("create_template", {"body": {"name": "MyTemplate"}})

    assert captured["path"] == "/api/templates"
    assert captured["body"] == {"name": "MyTemplate"}
