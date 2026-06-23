from fastapi import APIRouter

from core.sso import auth_router

from graphql_api.endpoint import graphql_app


main_router = APIRouter(prefix="/api")
main_router.include_router(auth_router)
main_router.include_router(graphql_app, prefix="/graphql")
