from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from application.iac.model import IacEnvironmentConfig, IacRun
from application.iac.schema import IacEnvironmentConfigCreate, IacPlanCreate
from application.iac.service import IacService
from application.source_codes.model import SourceCode
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityExistsError, EntityNotFound, EntityWrongState

MODULES = [
    {
        "name": "redis",
        "path": "terraform/redis",
        "environments": [
            {"name": "dev", "working_dir": "terraform/redis/dev", "var_files": []},
            {
                "name": "prod",
                "working_dir": "terraform/redis/prod",
                "regions": [
                    {"name": "eu-west-1", "working_dir": "terraform/redis/prod/eu-west-1"},
                    {"name": "us-east-1", "working_dir": "terraform/redis/prod/us-east-1"},
                ],
            },
        ],
    },
    {"name": "vpc", "path": "terraform/vpc", "environments": []},
]


def _source_code(**kwargs) -> SourceCode:
    defaults = {
        "id": uuid4(),
        "source_code_url": "https://github.com/org/infra",
        "repository_type": "iac",
        "status": ModelStatus.DONE,
        "default_branch": "main",
        "iac_modules": MODULES,
    }
    return SourceCode(**{**defaults, **kwargs})


@pytest.fixture
def crud():
    crud = Mock()
    crud.session = Mock()
    crud.session.get = AsyncMock(return_value=object())
    crud.get_environment_config_by_name = AsyncMock(return_value=Mock(spec=IacEnvironmentConfig, regions=[]))
    crud.get_active_run = AsyncMock(return_value=None)
    crud.get_integrations = AsyncMock(return_value=[])
    crud.create_run = AsyncMock(side_effect=lambda body: IacRun(id=uuid4(), created_at=datetime.now(), **body))
    crud.create_environment_config = AsyncMock(side_effect=lambda body: IacEnvironmentConfig(id=uuid4(), **body))
    crud.refresh = AsyncMock()
    return crud


@pytest.fixture
def source_code_crud():
    source_code_crud = Mock()
    source_code_crud.get_by_id = AsyncMock(return_value=_source_code())
    return source_code_crud


@pytest.fixture
def service(crud, source_code_crud, mock_event_sender, mock_audit_log_handler):
    return IacService(
        crud=crud,
        source_code_crud=source_code_crud,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def requester():
    return Mock(id=uuid4())


class TestPlan:
    async def test_queues_a_run_on_the_default_branch(self, service, crud, mock_event_sender, requester):
        run = await service.plan(
            uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="dev"), requester
        )

        assert run.status == ModelStatus.QUEUED
        assert (run.ref, run.sha, run.action) == ("main", None, "plan")
        mock_event_sender.send_task.assert_awaited_once()
        assert mock_event_sender.send_task.await_args.args == (run.id,)
        assert mock_event_sender.send_task.await_args.kwargs["action"] == ModelActions.DRYRUN

    async def test_picked_commit_has_no_ref(self, service, requester):
        run = await service.plan(
            uuid4(),
            IacPlanCreate(module_path="terraform/redis", environment_name="dev", sha="a" * 40),
            requester,
        )

        assert (run.ref, run.sha) == (None, "a" * 40)

    async def test_module_without_environments_runs_as_default(self, service, requester):
        run = await service.plan(
            uuid4(), IacPlanCreate(module_path="terraform/vpc", environment_name="default"), requester
        )

        assert run.environment_name == "default"

    async def test_unknown_module(self, service, requester):
        with pytest.raises(EntityNotFound, match="was not found at the last sync"):
            _ = await service.plan(uuid4(), IacPlanCreate(module_path="terraform/x", environment_name="dev"), requester)

    async def test_unknown_environment(self, service, requester):
        with pytest.raises(EntityNotFound, match="has no environment qa"):
            _ = await service.plan(
                uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="qa"), requester
            )

    async def test_region_is_required_for_regional_environments(self, service, requester):
        with pytest.raises(ValueError, match="Pick one of the regions of prod: eu-west-1, us-east-1"):
            _ = await service.plan(
                uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="prod"), requester
            )

    async def test_plans_one_region(self, service, crud, requester):
        run = await service.plan(
            uuid4(),
            IacPlanCreate(module_path="terraform/redis", environment_name="prod", region="us-east-1"),
            requester,
        )

        assert run.region == "us-east-1"
        assert crud.get_active_run.await_args.args[1:] == ("terraform/redis", "prod", "us-east-1")

    async def test_regions_declared_in_the_settings(self, service, crud, requester):
        crud.get_environment_config_by_name.return_value = Mock(spec=IacEnvironmentConfig, regions=["eu-central-1"])

        run = await service.plan(
            uuid4(),
            IacPlanCreate(module_path="terraform/redis", environment_name="dev", region="eu-central-1"),
            requester,
        )

        assert run.region == "eu-central-1"

    async def test_no_region_for_environments_without_regions(self, service, requester):
        with pytest.raises(ValueError, match="dev is not deployed to regions"):
            _ = await service.plan(
                uuid4(),
                IacPlanCreate(module_path="terraform/redis", environment_name="dev", region="eu-west-1"),
                requester,
            )

    async def test_environment_must_be_configured(self, service, crud, requester):
        crud.get_environment_config_by_name.return_value = None

        with pytest.raises(EntityWrongState, match="Configure the dev environment"):
            _ = await service.plan(
                uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="dev"), requester
            )

    async def test_one_run_at_a_time(self, service, crud, requester):
        crud.get_active_run.return_value = Mock()

        with pytest.raises(EntityWrongState, match="already has a run in progress"):
            _ = await service.plan(
                uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="dev"), requester
            )

    async def test_only_iac_repositories(self, service, source_code_crud, requester):
        source_code_crud.get_by_id.return_value = _source_code(repository_type="module_library")

        with pytest.raises(ValueError, match="Only Infrastructure as Code repositories"):
            _ = await service.plan(
                uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="dev"), requester
            )

    async def test_needs_a_sync_first(self, service, source_code_crud, requester):
        source_code_crud.get_by_id.return_value = _source_code(default_branch=None)

        with pytest.raises(EntityWrongState, match="Sync the repository"):
            _ = await service.plan(
                uuid4(), IacPlanCreate(module_path="terraform/redis", environment_name="dev"), requester
            )

    def test_commit_must_be_a_sha(self):
        with pytest.raises(ValidationError):
            _ = IacPlanCreate(module_path="m", environment_name="dev", sha="--upload-pack=evil")


class TestEnvironmentConfig:
    async def test_create(self, service, crud, requester):
        crud.get_environment_config_by_name.return_value = None

        config = await service.create_environment_config(uuid4(), IacEnvironmentConfigCreate(name=" dev "), requester)

        assert config.name == "dev"
        assert config.state_path_template == "{module}/{env}.tfstate"

    async def test_name_is_unique(self, service, requester):
        with pytest.raises(EntityExistsError):
            _ = await service.create_environment_config(uuid4(), IacEnvironmentConfigCreate(name="dev"), requester)

    async def test_only_cloud_integrations(self, service, crud, requester):
        crud.get_environment_config_by_name.return_value = None
        integration_id = uuid4()
        crud.get_integrations.return_value = [Mock(id=integration_id, integration_type="git")]
        crud.get_integrations.return_value[0].name = "github"

        with pytest.raises(ValueError, match="not a cloud integration"):
            _ = await service.create_environment_config(
                uuid4(), IacEnvironmentConfigCreate(name="dev", integration_ids=[integration_id]), requester
            )

    async def test_one_cloud_integration(self, service, crud, requester):
        crud.get_environment_config_by_name.return_value = None

        with pytest.raises(ValueError, match="only have one cloud integration"):
            _ = await service.create_environment_config(
                uuid4(), IacEnvironmentConfigCreate(name="dev", integration_ids=[uuid4(), uuid4()]), requester
            )
        crud.get_integrations.assert_not_called()

    def test_state_path_template_placeholders(self):
        with pytest.raises(ValidationError, match="may only use"):
            _ = IacEnvironmentConfigCreate(name="dev", state_path_template="{module}/{account}.tfstate")

    def test_region_variable_must_be_a_variable_name(self):
        with pytest.raises(ValidationError, match="valid variable name"):
            _ = IacEnvironmentConfigCreate(name="dev", region_variable="aws-region")


class TestVariables:
    def test_variable_names_must_be_valid(self):
        with pytest.raises(ValidationError, match="Invalid variable name"):
            _ = IacEnvironmentConfigCreate(name="dev", variables={"vpc-cidr": "x"})

    def test_region_variables_need_a_valid_region(self):
        with pytest.raises(ValidationError, match="Invalid region"):
            _ = IacEnvironmentConfigCreate(name="dev", region_variables={"EU West": {"a": "b"}})

    def test_empty_regions_are_dropped(self):
        config = IacEnvironmentConfigCreate(
            name="dev", region_variables={"eu-west-1": {}, "us-east-1": {" size ": "3"}}
        )

        assert config.region_variables == {"us-east-1": {"size": "3"}}
