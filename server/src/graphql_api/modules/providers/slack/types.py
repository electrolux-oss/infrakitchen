import strawberry


@strawberry.type
class SlackChannelType:
    id: str
    name: str
    is_channel: bool | None = None
    is_private: bool | None = None
    is_member: bool | None = None
    num_members: int | None = None


@strawberry.type
class SlackUserType:
    id: str
    name: str
    real_name: str | None = None
    is_bot: bool | None = None
    deleted: bool | None = None
    tz: str | None = None
