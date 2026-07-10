import json
import logging
from typing import Any

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
        if entity.action_mutation is not None:
            assert f"patch_action_{entity.name}" in names


@pytest.mark.asyncio
async def test_create_resource_posts_to_resources_endpoint():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        captured["auth"] = request.headers.get("Authorization")
        return httpx.Response(
            200,
            json={
                "data": {
                    "createResource": {"id": "abc", "name": "my-bucket", "description": "", "entityName": "resource"}
                }
            },
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
    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"input": {"name": "my-bucket", "templateId": "tmpl-1"}}
    assert "createResource(input: $input)" in captured["body"]["query"]
    assert captured["auth"] == "Bearer test-token"
    block = result.content[0]
    assert isinstance(block, TextContent)
    payload = json.loads(block.text)
    assert payload["entityName"] == "resource"


@pytest.mark.asyncio
async def test_patch_resource_patches_to_resource_endpoint():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "updateResource": {
                        "id": "abc",
                        "name": "my-bucket",
                        "description": "updated",
                        "entityName": "resource",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool(
        "patch_resource",
        {"entity_id": "abc", "body": {"description": "updated"}},
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "abc", "input": {"description": "updated"}}
    assert "updateResource(id: $id, input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_rejects_empty_body():
    server = _build_server(lambda req: httpx.Response(200, json={}))
    with pytest.raises(Exception) as exc:
        await server.call_tool("patch_resource", {"entity_id": "abc", "body": {}})
    assert "at least one field" in str(exc.value)


@pytest.mark.asyncio
async def test_patch_action_rejects_empty_action():
    server = _build_server(lambda req: httpx.Response(200, json={}))
    with pytest.raises(Exception) as exc:
        await server.call_tool("patch_action_resource", {"entity_id": "abc", "action": "  "})
    assert "non-empty string" in str(exc.value)


@pytest.mark.asyncio
async def test_create_resource_surfaces_backend_errors():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"data": None, "errors": [{"message": "Access denied", "path": ["createResource"]}]}
        )

    server = _build_server(handler)
    with pytest.raises(Exception) as exc:
        await server.call_tool(
            "create_resource",
            {"body": {"name": "x", "template_id": "tmpl-1"}},
        )
    assert "GraphQL mutation failed" in str(exc.value)
    assert "Access denied" in str(exc.value)


@pytest.mark.asyncio
async def test_create_template_hits_correct_path():
    """Template creation now goes through GraphQL mutations."""
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "createTemplate": {
                        "id": "tmpl-1",
                        "name": "MyTemplate",
                        "template": "my_template",
                        "entityName": "template",
                    }
                }
            },
        )

    server = _build_server(handler)
    result = await server.call_tool(
        "create_template",
        {"body": {"name": "MyTemplate", "cloud_resource_types": ["aws_s3_bucket"]}},
    )
    block = result.content[0]
    assert isinstance(block, TextContent)
    payload = json.loads(block.text)

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"input": {"name": "MyTemplate", "cloudResourceTypes": ["aws_s3_bucket"]}}
    assert "createTemplate(input: $input)" in captured["body"]["query"]
    assert payload["id"] == "tmpl-1"
    assert payload["entityName"] == "template"


@pytest.mark.asyncio
async def test_create_source_code_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "createSourceCode": {
                        "id": "sc-1",
                        "sourceCodeUrl": "https://github.com/example/repo.git",
                        "entityName": "source_code",
                    }
                }
            },
        )

    server = _build_server(handler)
    result = await server.call_tool(
        "create_source_code",
        {
            "body": {
                "source_code_url": "https://github.com/example/repo.git",
                "source_code_provider": "github",
                "source_code_language": "opentofu",
            }
        },
    )
    block = result.content[0]
    assert isinstance(block, TextContent)
    payload = json.loads(block.text)

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "input": {
            "sourceCodeUrl": "https://github.com/example/repo.git",
            "sourceCodeProvider": "github",
            "sourceCodeLanguage": "opentofu",
        }
    }
    assert "createSourceCode(input: $input)" in captured["body"]["query"]
    assert payload["entityName"] == "source_code"


@pytest.mark.asyncio
async def test_patch_source_code_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "updateSourceCode": {
                        "id": "sc-1",
                        "sourceCodeUrl": "https://github.com/example/repo.git",
                        "entityName": "source_code",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool("patch_source_code", {"entity_id": "sc-1", "body": {"description": "updated"}})

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "sc-1", "input": {"description": "updated"}}
    assert "updateSourceCode(id: $id, input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_action_source_code_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "sourceCodeAction": {
                        "id": "sc-1",
                        "sourceCodeUrl": "https://github.com/example/repo.git",
                        "entityName": "source_code",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool("patch_action_source_code", {"entity_id": "sc-1", "action": "disable"})

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "sc-1", "action": "disable"}
    assert "sourceCodeAction(id: $id, input: { action: $action })" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_create_source_code_version_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "createSourceCodeVersion": {
                        "id": "scv-1",
                        "sourceCodeFolder": "/",
                        "sourceCodeVersion": None,
                        "sourceCodeBranch": "main",
                        "entityName": "source_code_version",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool(
        "create_source_code_version",
        {
            "body": {
                "template_id": "tmpl-1",
                "source_code_id": "sc-1",
                "source_code_branch": "main",
                "source_code_folder": "/",
            }
        },
    )

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "input": {
            "templateId": "tmpl-1",
            "sourceCodeId": "sc-1",
            "sourceCodeBranch": "main",
            "sourceCodeFolder": "/",
        }
    }
    assert "createSourceCodeVersion(input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_source_code_version_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "updateSourceCodeVersion": {
                        "id": "scv-1",
                        "sourceCodeFolder": "/",
                        "sourceCodeVersion": "v1.0.0",
                        "sourceCodeBranch": None,
                        "entityName": "source_code_version",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool("patch_source_code_version", {"entity_id": "scv-1", "body": {"description": "updated"}})

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "scv-1", "input": {"description": "updated"}}
    assert "updateSourceCodeVersion(id: $id, input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_create_storage_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "createStorage": {
                        "id": "st-1",
                        "name": "state-bucket",
                        "storageType": "tofu",
                        "storageProvider": "aws",
                        "entityName": "storage",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool(
        "create_storage",
        {
            "body": {
                "name": "state-bucket",
                "storage_type": "tofu",
                "storage_provider": "aws",
                "integration_id": "int-1",
                "configuration": {
                    "storage_provider": "aws",
                    "aws_bucket_name": "bucket",
                    "aws_region": "eu-west-1",
                },
            }
        },
    )

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "input": {
            "name": "state-bucket",
            "storageType": "tofu",
            "storageProvider": "aws",
            "integrationId": "int-1",
            "configuration": {
                "storage_provider": "aws",
                "aws_bucket_name": "bucket",
                "aws_region": "eu-west-1",
            },
        }
    }
    assert "createStorage(input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_storage_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "updateStorage": {
                        "id": "st-1",
                        "name": "state-bucket",
                        "storageType": "tofu",
                        "storageProvider": "aws",
                        "entityName": "storage",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool("patch_storage", {"entity_id": "st-1", "body": {"description": "updated"}})

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "st-1", "input": {"description": "updated"}}
    assert "updateStorage(id: $id, input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_action_resource_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "resourceAction": {
                        "id": "abc",
                        "name": "my-bucket",
                        "description": "",
                        "entityName": "resource",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool("patch_action_resource", {"entity_id": "abc", "action": "approve"})

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "abc", "action": "approve"}
    assert "resourceAction(id: $id, input: { action: $action })" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_template_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "updateTemplate": {
                        "id": "tmpl-1",
                        "name": "Updated Template",
                        "template": "updated_template",
                        "entityName": "template",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool(
        "patch_template",
        {"entity_id": "tmpl-1", "body": {"cloud_resource_types": ["aws_vpc"], "name": "Updated Template"}},
    )

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "id": "tmpl-1",
        "input": {"cloudResourceTypes": ["aws_vpc"], "name": "Updated Template"},
    }
    assert "updateTemplate(id: $id, input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_create_executor_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "createExecutor": {
                        "id": "exec-1",
                        "name": "plan-runner",
                        "runtime": "tofu",
                        "entityName": "executor",
                    }
                }
            },
        )

    server = _build_server(handler)
    result = await server.call_tool(
        "create_executor",
        {
            "body": {
                "name": "plan-runner",
                "source_code_id": "sc-1",
                "storage_id": "st-1",
                "storage_path": "executors/plan-runner.tfstate",
                "integration_ids": ["int-1"],
            }
        },
    )
    block = result.content[0]
    assert isinstance(block, TextContent)
    payload = json.loads(block.text)

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "input": {
            "name": "plan-runner",
            "sourceCodeId": "sc-1",
            "storageId": "st-1",
            "storagePath": "executors/plan-runner.tfstate",
            "integrationIds": ["int-1"],
        }
    }
    assert "createExecutor(input: $input)" in captured["body"]["query"]
    assert payload["entityName"] == "executor"


@pytest.mark.asyncio
async def test_create_integration_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "createIntegration": {
                        "id": "int-1",
                        "name": "aws-prod",
                        "integrationProvider": "aws",
                        "entityName": "integration",
                    }
                }
            },
        )

    server = _build_server(handler)
    result = await server.call_tool(
        "create_integration",
        {
            "body": {
                "name": "aws-prod",
                "integration_type": "cloud",
                "integration_provider": "aws",
                "configuration": {
                    "integration_provider": "aws",
                    "aws_account": "123456789012",
                },
            }
        },
    )
    block = result.content[0]
    assert isinstance(block, TextContent)
    payload = json.loads(block.text)

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "input": {
            "name": "aws-prod",
            "integrationType": "cloud",
            "integrationProvider": "aws",
            "configuration": {
                "integration_provider": "aws",
                "aws_account": "123456789012",
            },
        }
    }
    assert "createIntegration(input: $input)" in captured["body"]["query"]
    assert payload["entityName"] == "integration"


@pytest.mark.asyncio
async def test_patch_integration_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "updateIntegration": {
                        "id": "int-1",
                        "name": "aws-prod",
                        "integrationProvider": "aws",
                        "entityName": "integration",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool(
        "patch_integration",
        {
            "entity_id": "int-1",
            "body": {
                "description": "updated",
                "configuration": {
                    "integration_provider": "aws",
                    "aws_account": "123456789012",
                },
            },
        },
    )

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {
        "id": "int-1",
        "input": {
            "description": "updated",
            "configuration": {
                "integration_provider": "aws",
                "aws_account": "123456789012",
            },
        },
    }
    assert "updateIntegration(id: $id, input: $input)" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_patch_action_integration_uses_graphql_mutation():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": {
                    "integrationAction": {
                        "id": "int-1",
                        "name": "aws-prod",
                        "integrationProvider": "aws",
                        "entityName": "integration",
                    }
                }
            },
        )

    server = _build_server(handler)
    await server.call_tool("patch_action_integration", {"entity_id": "int-1", "action": "disable"})

    assert captured["path"] == "/api/graphql"
    assert captured["body"]["variables"] == {"id": "int-1", "action": "disable"}
    assert "integrationAction(id: $id, input: { action: $action })" in captured["body"]["query"]


@pytest.mark.asyncio
async def test_create_template_surfaces_graphql_errors():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": None,
                "errors": [
                    {
                        "message": "Access denied",
                        "path": ["createTemplate"],
                    }
                ],
            },
        )

    server = _build_server(handler)
    with pytest.raises(Exception) as exc:
        await server.call_tool("create_template", {"body": {"name": "x", "template": "x"}})
    assert "GraphQL mutation failed" in str(exc.value)
    assert "Access denied" in str(exc.value)
