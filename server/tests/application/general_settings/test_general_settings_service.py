from types import SimpleNamespace
from typing import cast
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from core.users.model import UserDTO
from application.general_settings.crud import GeneralSettingsCRUD
from application.general_settings.model import (
    BANNER_MESSAGE_MAX_LENGTH,
    BannerSettings,
    INSTANCE_NAME_MAX_LENGTH,
    GENERAL_SETTINGS_ID,
    GeneralSettingsDTO,
)
from application.general_settings.service import GeneralSettingsService


def make_service(stored: dict[str, Any]) -> tuple[GeneralSettingsService, Mock, Mock]:
    crud = Mock(spec=GeneralSettingsCRUD)
    crud.get_all = AsyncMock(return_value=stored)
    crud.upsert = AsyncMock()
    audit_log_handler = Mock(create_log=AsyncMock())
    return GeneralSettingsService(crud=crud, audit_log_handler=audit_log_handler), crud, audit_log_handler


async def test_banner_is_off_until_saved():
    service, _, _ = make_service({})

    assert (await service.get()).announcement == ""


async def test_announcement_is_empty_while_the_banner_is_disabled():
    settings = GeneralSettingsDTO(banner=BannerSettings(enabled=False, message="Maintenance tonight"))

    assert settings.announcement == ""
    assert (
        GeneralSettingsDTO(banner=BannerSettings(enabled=True, message="Maintenance tonight")).announcement
        == "Maintenance tonight"
    )


async def test_get_ignores_unknown_keys_and_defaults_missing_ones():
    service, _, _ = make_service({"name": "prod", "removed_setting": 1})

    settings = await service.get()

    assert (settings.name, settings.banner.enabled) == ("prod", False)


async def test_save_upserts_every_setting_and_writes_an_audit_log():
    service, crud, audit_log_handler = make_service({})
    requester = SimpleNamespace(id=uuid4())

    saved = await service.update(
        GeneralSettingsDTO(
            name="  production ", banner=BannerSettings(enabled=True, message=" Maintenance ", color="orange")
        ),
        cast(UserDTO, cast(object, requester)),
    )

    expected = {
        "name": "production",
        "banner": {"enabled": True, "message": "Maintenance", "color": "orange"},
    }
    crud.upsert.assert_awaited_once_with(expected, requester.id)
    assert saved.announcement == "Maintenance"
    log = audit_log_handler.create_log.call_args
    assert log.args[:3] == (GENERAL_SETTINGS_ID, requester.id, "update")
    assert log.kwargs["action_metadata"] == expected


def test_name_and_banner_are_limited_in_length():
    with pytest.raises(ValidationError):
        GeneralSettingsDTO(name="x" * (INSTANCE_NAME_MAX_LENGTH + 1))
    with pytest.raises(ValidationError):
        GeneralSettingsDTO(banner=BannerSettings(message="x" * (BANNER_MESSAGE_MAX_LENGTH + 1)))
    with pytest.raises(ValidationError):
        BannerSettings(color="pink")  # pyright: ignore[reportArgumentType]
