import strawberry


@strawberry.type
class RefreshAuthTokenType:
    token: str
    expiration: str
    provider: str


@strawberry.type
class LogoutResponseType:
    success: bool


@strawberry.type
class ServiceAccountTokenType:
    token: str
    expires_at: str
