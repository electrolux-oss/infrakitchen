from typing import Any
from uuid import uuid4

import pytest

from application.source_code_versions.model import (
    SourceConfig,
    SourceConfigTemplateReference,
    SourceOutputConfig,
)
from application.source_code_versions.schema import OutputVariableModel, VariableModel

SCV_ID = uuid4()
TEMPLATE_ID = uuid4()


def make_config(name: str, index: int = 0, scv_id=SCV_ID, **kwargs: Any) -> SourceConfig:
    values: dict[str, Any] = {
        "id": uuid4(),
        "source_code_version_id": scv_id,
        "name": name,
        "index": index,
        "description": f"{name} description",
        "type": "string",
        "required": True,
        "default": None,
        "sensitive": False,
        "frozen": False,
        "unique": False,
        "restricted": False,
        "options": [],
    }
    values.update(kwargs)
    return SourceConfig(**values)


def make_output(name: str, index: int = 0, description: str = "") -> SourceOutputConfig:
    return SourceOutputConfig(
        id=uuid4(), source_code_version_id=SCV_ID, name=name, index=index, description=description
    )


def variable(name: str, **kwargs: Any) -> VariableModel:
    kwargs.setdefault("description", f"{name} description")
    kwargs.setdefault("type", "string")
    return VariableModel(name=name, **kwargs)


async def run_sync(service, variables, outputs=None, previous=None):
    return await service.sync_configs_with_code(
        source_code_version_id=SCV_ID,
        template_id=TEMPLATE_ID,
        variables=variables,
        outputs=outputs or [],
        previous_variables=previous or [],
    )


class TestSyncConfigsWithCode:
    @pytest.mark.asyncio
    async def test_first_sync_creates_all_configs_and_outputs(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = []

        summary = await run_sync(
            mock_source_code_version_service,
            [variable("region", default="eu-west-1", type="string"), variable("name")],
            [OutputVariableModel(name="arn", value="x", description="ARN")],
        )

        assert summary.added_configs == ["region", "name"]
        assert summary.added_outputs == ["arn"]
        created = [c.args[0] for c in mock_source_code_version_crud.create_config.call_args_list]
        assert created[0]["name"] == "region"
        assert created[0]["required"] is False
        assert created[0]["default"] == "eu-west-1"
        assert created[0]["index"] == 0
        assert created[1]["name"] == "name"
        assert created[1]["required"] is True
        assert created[1]["index"] == 1
        output_body = mock_source_code_version_crud.create_output_config.call_args.args[0]
        assert output_body["name"] == "arn"
        assert output_body["description"] == "ARN"

    @pytest.mark.asyncio
    async def test_resync_adds_new_variable(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [make_config("name")]

        summary = await run_sync(mock_source_code_version_service, [variable("name"), variable("tags")])

        assert summary.added_configs == ["tags"]
        assert summary.updated_configs == []
        assert summary.removed_configs == []
        mock_source_code_version_crud.create_config.assert_awaited_once()
        assert mock_source_code_version_crud.create_config.call_args.args[0]["index"] == 1

    @pytest.mark.asyncio
    async def test_resync_updates_code_derived_fields(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        config = make_config("name")
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [config]

        summary = await run_sync(
            mock_source_code_version_service,
            [variable("name", description="New description", type="number", sensitive=True)],
            previous=[variable("name")],
        )

        assert summary.updated_configs == ["name"]
        mock_source_code_version_crud.update_config.assert_awaited_once_with(
            config, {"description": "New description", "type": "number", "sensitive": True}
        )

    @pytest.mark.asyncio
    async def test_resync_without_changes_does_not_update(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [make_config("name")]

        summary = await run_sync(mock_source_code_version_service, [variable("name")], previous=[variable("name")])

        assert summary.updated_configs == []
        mock_source_code_version_crud.update_config.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_resync_updates_default_when_not_customized(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        config = make_config("region", required=False, default="eu-west-1")
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [config]

        await run_sync(
            mock_source_code_version_service,
            [variable("region", default="us-east-1")],
            previous=[variable("region", default="eu-west-1")],
        )

        mock_source_code_version_crud.update_config.assert_awaited_once_with(config, {"default": "us-east-1"})

    @pytest.mark.asyncio
    async def test_resync_keeps_user_customized_fields(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        config = make_config(
            "region",
            required=True,
            default="ap-south-1",
            frozen=True,
            unique=True,
            restricted=True,
            options=["ap-south-1", "eu-west-1"],
        )
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [config]

        await run_sync(
            mock_source_code_version_service,
            [variable("region", default="us-east-1", description="Changed")],
            previous=[variable("region", default="eu-west-1")],
        )

        mock_source_code_version_crud.update_config.assert_awaited_once_with(config, {"description": "Changed"})

    @pytest.mark.asyncio
    async def test_resync_keeps_default_when_previous_variable_unknown(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        config = make_config("region", required=False, default="eu-west-1")
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [config]

        summary = await run_sync(mock_source_code_version_service, [variable("region", default="us-east-1")])

        assert summary.updated_configs == []
        mock_source_code_version_crud.update_config.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_resync_removes_deleted_variable_and_its_reference(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        removed = make_config("vpc_id", index=1)
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [make_config("name"), removed]
        reference = SourceConfigTemplateReference(
            template_id=TEMPLATE_ID,
            reference_template_id=uuid4(),
            input_config_name="vpc_id",
            output_config_name="id",
        )
        mock_source_code_version_crud.get_reference_output_configs_by_template_id.return_value = [reference]

        summary = await run_sync(mock_source_code_version_service, [variable("name")], previous=[variable("name")])

        assert summary.removed_configs == ["vpc_id"]
        assert summary.removed_references == ["vpc_id"]
        mock_source_code_version_crud.delete_config.assert_awaited_once_with(removed)
        mock_source_code_version_crud.delete_template_references.assert_awaited_once_with(reference)

    @pytest.mark.asyncio
    async def test_resync_keeps_reference_used_by_other_version(
        self, mock_source_code_version_service, mock_source_code_version_crud
    ):
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = [make_config("vpc_id")]
        mock_source_code_version_crud.get_configs_by_template_ids.return_value = {
            TEMPLATE_ID: [make_config("vpc_id", scv_id=uuid4())]
        }
        mock_source_code_version_crud.get_reference_output_configs_by_template_id.return_value = [
            SourceConfigTemplateReference(
                template_id=TEMPLATE_ID,
                reference_template_id=uuid4(),
                input_config_name="vpc_id",
                output_config_name="id",
            )
        ]

        summary = await run_sync(mock_source_code_version_service, [])

        assert summary.removed_configs == ["vpc_id"]
        assert summary.removed_references == []
        mock_source_code_version_crud.delete_template_references.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_resync_reconciles_outputs(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.get_configs_by_scv_id.return_value = []
        kept = make_output("arn", index=0, description="Old")
        removed = make_output("name", index=1)
        mock_source_code_version_crud.get_output_configs_by_scv_id.return_value = [kept, removed]

        summary = await run_sync(
            mock_source_code_version_service,
            [],
            [
                OutputVariableModel(name="arn", value="x", description="New"),
                OutputVariableModel(name="id", value="y"),
            ],
        )

        assert summary.updated_outputs == ["arn"]
        assert summary.added_outputs == ["id"]
        assert summary.removed_outputs == ["name"]
        mock_source_code_version_crud.update_output_config.assert_awaited_once_with(kept, {"description": "New"})
        mock_source_code_version_crud.delete_output_config.assert_awaited_once_with(removed)
