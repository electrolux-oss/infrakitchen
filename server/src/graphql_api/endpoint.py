import logging
from typing import Any

from strawberry.fastapi import GraphQLRouter
from strawberry.http import GraphQLHTTPResponse
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL
from strawberry.types import ExecutionResult
from starlette.requests import Request

from .context import get_context
from .error_handling import format_graphql_error, log_graphql_error
from .schema import schema

logger = logging.getLogger(__name__)


class InfraKitchenGraphQLRouter(GraphQLRouter[dict[str, Any], None]):
    async def process_result(self, request: Request, result: ExecutionResult) -> GraphQLHTTPResponse:
        response = await super().process_result(request, result)

        if not result.errors:
            return response

        response["errors"] = [format_graphql_error(error) for error in result.errors]
        for error in result.errors:
            log_graphql_error(error)

        return response


graphql_app = InfraKitchenGraphQLRouter(
    schema,
    context_getter=get_context,
    subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL],
)
