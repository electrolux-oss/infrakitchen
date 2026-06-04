from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper
from core.auth_providers.model import AuthProvider
from graphql_api.modules.user.types import UserType


auth_provider_mapper = StrawberrySQLAlchemyMapper()


@auth_provider_mapper.type(AuthProvider)
class AuthProviderType:
    __exclude__ = ["created_by"]

    creator: UserType | None = None


auth_provider_mapper.finalize()
