import logging

from strawberry.fastapi import GraphQLRouter

from .context import get_context
from .schema import schema

logger = logging.getLogger(__name__)


graphql_app = GraphQLRouter(schema, context_getter=get_context)
