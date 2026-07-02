import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.resources.schema import ResourceTreeResponse
from core.constants.model import ModelActions
from graphql_api.schema import schema

RESOURCE_TREE_QUERY = """
    query ResourceTree($id: UUID!, $direction: String!) {
        resourceTree(id: $id, direction: $direction) {
            id
            nodeId
            name
            state
            status
            templateName
            children {
                id
                nodeId
                name
                state
                status
                templateName
            }
        }
    }
"""

RESOURCE_METADATA_QUERY = """
    query ResourceMetadata($id: UUID!) {
        resourceMetadata(id: $id)
    }
"""

RESOURCE_DOWNLOAD_QUERY = """
    query ResourceDownload($id: UUID!) {
        resourceDownload(id: $id) {
            filename
            contentType
            contentBase64
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestResourceQueries:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.queries.get_resource_service")
    async def test_resource_tree_returns_tree(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        child = ResourceTreeResponse(
            id=uuid4(),
            node_id=uuid4(),
            name="child",
            status="active",
            state="provisioned",
            template_name="child-template",
            children=[],
        )
        root = ResourceTreeResponse(
            id=uuid4(),
            node_id=uuid4(),
            name="root",
            status="active",
            state="provisioned",
            template_name="root-template",
            children=[child],
        )
        mock_resource_service.get_tree = AsyncMock(return_value=root)
        mock_get_service.return_value = mock_resource_service

        result = await schema.execute(
            RESOURCE_TREE_QUERY,
            variable_values={"id": str(root.id), "direction": "children"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "resourceTree": {
                "id": str(root.id),
                "nodeId": str(root.node_id),
                "name": "root",
                "state": "provisioned",
                "status": "active",
                "templateName": "root-template",
                "children": [
                    {
                        "id": str(child.id),
                        "nodeId": str(child.node_id),
                        "name": "child",
                        "state": "provisioned",
                        "status": "active",
                        "templateName": "child-template",
                    }
                ],
            }
        }
        mock_resource_service.get_tree.assert_awaited_once_with(
            resource_id=str(root.id),
            direction="children",
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.queries.get_resource_service")
    async def test_resource_tree_requires_authentication(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        mock_resource_service.get_tree = AsyncMock()
        mock_get_service.return_value = mock_resource_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            RESOURCE_TREE_QUERY,
            variable_values={"id": str(uuid4()), "direction": "children"},
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["resourceTree"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_resource_service.get_tree.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.queries.get_resource_service")
    async def test_resource_metadata_returns_json(
        self,
        mock_get_service,
        mock_resource_service,
        mocked_user,
    ):
        metadata = {
            "bucket": {
                "name": "acme-bucket",
                "region": "eu-north-1",
            }
        }
        mock_resource_service.metadata = AsyncMock(return_value=metadata)
        mock_get_service.return_value = mock_resource_service

        resource_id = uuid4()
        result = await schema.execute(
            RESOURCE_METADATA_QUERY,
            variable_values={"id": str(resource_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"resourceMetadata": metadata}
        mock_resource_service.metadata.assert_awaited_once_with(resource_id=str(resource_id))

    @pytest.mark.asyncio
    @patch("graphql_api.modules.resource.queries.get_resource_task")
    @patch("graphql_api.modules.resource.queries.get_resource_service")
    async def test_resource_download_returns_base64_payload(
        self,
        mock_get_service,
        mock_get_resource_task,
        mocked_user,
        tmp_path,
    ):
        resource_id = uuid4()
        resource = SimpleNamespace(id=resource_id)
        debug_zip = tmp_path / "debug.zip"
        debug_zip.write_bytes(b"zip-content")

        mock_resource_service = Mock()
        mock_resource_service.query_by_id = AsyncMock(return_value=resource)
        mock_get_service.return_value = mock_resource_service

        task_controller = Mock()
        task_controller.debug = AsyncMock(return_value=str(debug_zip))
        mock_get_resource_task.return_value = task_controller

        result = await schema.execute(
            RESOURCE_DOWNLOAD_QUERY,
            variable_values={"id": str(resource_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "resourceDownload": {
                "filename": "debug.zip",
                "contentType": "application/zip",
                "contentBase64": base64.b64encode(b"zip-content").decode("ascii"),
            }
        }
        mock_resource_service.query_by_id.assert_awaited_once_with(resource_id)
        mock_get_resource_task.assert_awaited_once_with(
            session=mock_get_service.call_args.kwargs["session"],
            obj_id=resource_id,
            user=mocked_user,
            action=ModelActions.DOWNLOAD,
        )
        task_controller.debug.assert_awaited_once_with()
