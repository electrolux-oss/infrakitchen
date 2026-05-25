from pydantic import BaseModel, ConfigDict, Field


class SlackChannel(BaseModel):
    id: str = Field(...)
    name: str = Field(...)
    is_channel: bool | None = Field(default=None)
    is_private: bool | None = Field(default=None)
    is_member: bool | None = Field(default=None)
    num_members: int | None = Field(default=None)

    model_config = ConfigDict(extra="allow")


class SlackUser(BaseModel):
    id: str = Field(...)
    name: str = Field(...)
    real_name: str | None = Field(default=None)
    is_bot: bool | None = Field(default=None)
    deleted: bool | None = Field(default=None)
    tz: str | None = Field(default=None)
    profile: dict[str, object] | None = Field(default=None)

    model_config = ConfigDict(extra="allow")