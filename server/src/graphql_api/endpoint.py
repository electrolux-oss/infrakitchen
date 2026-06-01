import logging

from strawberry.fastapi import GraphQLRouter
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL

from .context import get_context
from .schema import schema

logger = logging.getLogger(__name__)


graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,
    subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL],
)
