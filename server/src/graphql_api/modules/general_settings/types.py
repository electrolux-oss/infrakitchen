import strawberry

from application.general_settings.model import GeneralSettingsDTO


@strawberry.type
class GeneralSettingsType:
    name: str
    banner_enabled: bool
    banner_message: str
    banner_color: str

    @classmethod
    def from_pydantic(cls, settings: GeneralSettingsDTO) -> "GeneralSettingsType":
        return cls(
            name=settings.name,
            banner_enabled=settings.banner_enabled,
            banner_message=settings.banner_message,
            banner_color=settings.banner_color,
        )


@strawberry.input
class GeneralSettingsInput:
    name: str
    banner_enabled: bool
    banner_message: str
    banner_color: str
