from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from core.errors import EntityNotFound
from core.cloud_resources.model import CloudResourceModel
from graphql_api.schema import schema

CLOUD_RESOURCES_QUERY = """
    query CloudResources($filter: JSON, $sort: [String!], $range: [Int!]) {
        cloudResources(filter: $filter, sort: $sort, range: $range) {
            id
            name
            provider
            status
            entityName
        }
        cloudResourcesCount(filter: $filter)
    }
"""

CLOUD_RESOURCE_QUERY = """
    query CloudResource($id: String!) {
        cloudResource(id: $id) {
            id
            name
            provider
            status
            entityName
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestCloudResourceQueries:
    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_has_access_to_api", new_callable=AsyncMock, return_value=True)
    @patch("graphql_api.modules.cloud_resource.queries.get_cloud_resources")
    async def test_cloud_resources_returns_filtered_sorted_paginated_resources(
        self,
        mock_get_cloud_resources,
        mock_user_has_access_to_api,
        mocked_user,
    ):
        mock_get_cloud_resources.return_value = [
            CloudResourceModel(id="aws_eks", provider="aws", name="aws_eks"),
            CloudResourceModel(id="azure_vm", provider="azure", name="azure_vm"),
            CloudResourceModel(id="aws_lambda", provider="aws", name="aws_lambda"),
        ]

        result = await schema.execute(
            CLOUD_RESOURCES_QUERY,
            variable_values={
                "filter": {"provider": "aws"},
                "sort": ["name", "ASC"],
                "range": [0, 0],
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "cloudResources": [
                {
                    "id": "aws_eks",
                    "name": "aws_eks",
                    "provider": "aws",
                    "status": "enabled",
                    "entityName": "cloud_resource",
                }
            ],
            "cloudResourcesCount": 2,
        }
        mock_get_cloud_resources.assert_awaited()
        mock_user_has_access_to_api.assert_awaited()

    @pytest.mark.asyncio
    async def test_cloud_resources_requires_authentication(self, mocked_user):
        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CLOUD_RESOURCES_QUERY,
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["cloudResources"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)

    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_has_access_to_api", new_callable=AsyncMock, return_value=True)
    @patch("graphql_api.modules.cloud_resource.queries.get_cloud_resource")
    async def test_cloud_resource_returns_single_resource(
        self,
        mock_get_cloud_resource,
        mock_user_has_access_to_api,
        mocked_user,
    ):
        mock_get_cloud_resource.return_value = CloudResourceModel(
            id="aws_eks",
            provider="aws",
            name="aws_eks",
        )

        result = await schema.execute(
            CLOUD_RESOURCE_QUERY,
            variable_values={"id": "aws_eks"},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "cloudResource": {
                "id": "aws_eks",
                "name": "aws_eks",
                "provider": "aws",
                "status": "enabled",
                "entityName": "cloud_resource",
            }
        }
        mock_user_has_access_to_api.assert_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_has_access_to_api", new_callable=AsyncMock, return_value=True)
    @patch("graphql_api.modules.cloud_resource.queries.get_cloud_resource")
    async def test_cloud_resource_propagates_not_found(
        self,
        mock_get_cloud_resource,
        mock_user_has_access_to_api,
        mocked_user,
    ):
        mock_get_cloud_resource.side_effect = EntityNotFound("Resource missing")

        result = await schema.execute(
            CLOUD_RESOURCE_QUERY,
            variable_values={"id": "missing"},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["cloudResource"] is None
        assert result.errors is not None
        assert any("Resource missing" in error.message for error in result.errors)
        mock_user_has_access_to_api.assert_awaited()
