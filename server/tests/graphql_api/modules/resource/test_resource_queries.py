from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.resources.schema import ResourceTreeResponse
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
