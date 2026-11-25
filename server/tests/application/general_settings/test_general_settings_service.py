from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from application.general_settings.crud import GeneralSettingsCRUD
from application.general_settings.model import (
    BANNER_MESSAGE_MAX_LENGTH,
    INSTANCE_NAME_MAX_LENGTH,
    GENERAL_SETTINGS_ID,
    GeneralSettings,
    GeneralSettingsDTO,
)
from application.general_settings.service import GeneralSettingsService


def make_service(row: GeneralSettings | None) -> tuple[GeneralSettingsService, Mock]:
    crud = Mock(spec=GeneralSettingsCRUD)
    crud.get = AsyncMock(return_value=row)
    crud.get_or_create = AsyncMock(return_value=row)

    async def update(existing: GeneralSettings, body: dict[str, Any]) -> GeneralSettings:
        for key, value in body.items():
            setattr(existing, key, value)
        return existing

    crud.update = AsyncMock(side_effect=update)
    audit_log_handler = Mock(create_log=AsyncMock())
    return GeneralSettingsService(crud=crud, audit_log_handler=audit_log_handler), audit_log_handler


async def test_banner_is_off_until_saved():
    service, _ = make_service(None)

    assert (await service.get()).announcement == ""


async def test_announcement_is_empty_while_the_banner_is_disabled():
    settings = GeneralSettingsDTO(banner_enabled=False, banner_message="Maintenance tonight")

    assert settings.announcement == ""
    assert settings.model_copy(update={"banner_enabled": True}).announcement == "Maintenance tonight"


async def test_save_updates_the_row_and_writes_an_audit_log():
    row = GeneralSettings(id=GENERAL_SETTINGS_ID, name="")
    service, audit_log_handler = make_service(row)
    requester = SimpleNamespace(id=uuid4())

    saved = await service.update(
        GeneralSettingsDTO(
            name="  production ", banner_enabled=True, banner_message=" Maintenance ", banner_color="orange"
        ),
        requester,
    )  # pyright: ignore[reportArgumentType]

    assert (row.name, row.banner_enabled, row.banner_message, row.updated_by) == (
        "production",
        True,
        "Maintenance",
        requester.id,
    )
    assert saved.announcement == "Maintenance"
    log = audit_log_handler.create_log.call_args
    assert log.args[:3] == (GENERAL_SETTINGS_ID, requester.id, "update")
    assert log.kwargs["action_metadata"] == {
        "name": "production",
        "banner_enabled": True,
        "banner_message": "Maintenance",
        "banner_color": "orange",
    }


def test_name_and_banner_are_limited_in_length():
    with pytest.raises(ValidationError):
        GeneralSettingsDTO(name="x" * (INSTANCE_NAME_MAX_LENGTH + 1))
    with pytest.raises(ValidationError):
        GeneralSettingsDTO(banner_message="x" * (BANNER_MESSAGE_MAX_LENGTH + 1))
    with pytest.raises(ValidationError):
        GeneralSettingsDTO(banner_color="pink")  # pyright: ignore[reportArgumentType]
