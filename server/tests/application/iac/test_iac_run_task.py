import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.iac.model import IacEnvironmentConfig, IacRun
from application.iac.task import IacRunTask
from application.source_codes.iac import discover_iac_modules
from application.source_codes.model import SourceCode
from core.constants.model import ModelActions, ModelStatus
from core.errors import CannotProceed
from core.tools.functions import ResolvedTool

pytestmark = pytest.mark.skipif(shutil.which("tofu") is None, reason="needs the tofu binary")

MODULE = """
terraform {{
  backend "local" {{
    path = "{state}"
  }}
}}

variable "size" {{
  type = number
}}

resource "terraform_data" "cache" {{
  input = var.size
}}
"""


def _git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    repo = tmp_path / "infra"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "dev@example.com")
    _git(repo, "config", "user.name", "Dev")
    _ = (repo / "README.md").write_text("infra")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "init")
    for env in ["dev", "prod"]:
        folder = repo / "terraform" / "redis" / env
        folder.mkdir(parents=True)
        _ = (folder / "main.tf").write_text(MODULE.format(state=tmp_path / f"{env}.tfstate"))
        _ = (folder / f"{env}.tfvars").write_text("size = 2\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "add redis")
    return repo


@pytest.fixture(autouse=True)
def default_tofu(monkeypatch):
    monkeypatch.setattr(
        "application.iac.task.resolve_tool_to_run",
        AsyncMock(return_value=ResolvedTool(path=None, label="tofu installed on the worker")),
    )


def _source_code(repo: Path) -> SourceCode:
    return SourceCode(
        id=uuid4(),
        source_code_url=f"file://{repo}",
        repository_type="iac",
        status=ModelStatus.DONE,
        default_branch="main",
        git_tag_shas={},
        integration=None,
        iac_modules=[m.model_dump() for m in discover_iac_modules(str(repo), repository_name="infra")],
    )


def _config(**kwargs) -> IacEnvironmentConfig:
    defaults: dict[str, Any] = {
        "id": uuid4(),
        "name": "dev",
        "integrations": [],
        "storage": None,
        "storage_id": None,
        "tool_id": None,
        "state_path_template": "{module}/{env}.tfstate",
    }
    return IacEnvironmentConfig(**{**defaults, **kwargs})


def _task(source_code: SourceCode, run: IacRun, config: IacEnvironmentConfig | None, tmp_path: Path) -> IacRunTask:
    entity_logger = Mock()
    entity_logger.save_log = AsyncMock()
    crud = Mock()
    crud.refresh = AsyncMock()
    return IacRunTask(
        session=AsyncMock(),
        crud=cast(Any, crud),
        run=run,
        source_code=source_code,
        environment_config=config,
        task_service=AsyncMock(),
        logger=entity_logger,
        user=Mock(identifier="tester"),
        event_sender=AsyncMock(),
        action=ModelActions.DRYRUN,
        workspace_root=tempfile.mkdtemp(dir=tmp_path),
    )


def _run(source_code: SourceCode, **kwargs) -> IacRun:
    defaults: dict[str, Any] = {
        "id": uuid4(),
        "source_code_id": source_code.id,
        "module_path": "terraform/redis",
        "environment_name": "dev",
        "action": "plan",
        "ref": "main",
        "sha": None,
        "status": ModelStatus.QUEUED,
        "created_at": datetime.now(),
    }
    return IacRun(**{**defaults, **kwargs})


class TestPlan:
    async def test_plans_the_head_of_the_branch(self, repo: Path, tmp_path: Path):
        source_code = _source_code(repo)
        run = _run(source_code)
        task = _task(source_code, run, _config(), tmp_path)

        await task.start_pipeline()

        assert run.status == ModelStatus.DONE
        assert run.sha == _git(repo, "rev-parse", "HEAD")
        assert (run.to_add, run.to_change, run.to_destroy) == (1, 0, 0)
        assert run.started_at is not None and run.finished_at is not None
        assert not Path(task.workspace_root).exists()

    async def test_plans_a_picked_commit(self, repo: Path, tmp_path: Path):
        source_code = _source_code(repo)
        head = _git(repo, "rev-parse", "HEAD")
        _ = (repo / "README.md").write_text("newer")
        _git(repo, "commit", "-q", "-am", "newer")
        run = _run(source_code, ref=None, sha=head)

        await _task(source_code, run, _config(), tmp_path).start_pipeline()

        assert run.sha == head
        assert run.status == ModelStatus.DONE

    async def test_module_missing_at_the_commit(self, repo: Path, tmp_path: Path):
        source_code = _source_code(repo)
        first = _git(repo, "rev-list", "--max-parents=0", "HEAD")
        run = _run(source_code, ref=None, sha=first)

        with pytest.raises(CannotProceed, match="does not exist at"):
            await _task(source_code, run, _config(), tmp_path).start_pipeline()

    async def test_environment_must_be_configured(self, repo: Path, tmp_path: Path):
        source_code = _source_code(repo)
        run = _run(source_code)
        task = _task(source_code, run, None, tmp_path)

        with pytest.raises(CannotProceed, match="is not configured"):
            await task.start_pipeline()
        await task.make_failed()

        assert run.status == ModelStatus.ERROR

    async def test_needs_a_backend(self, repo: Path, tmp_path: Path):
        main_tf = repo / "terraform" / "redis" / "dev" / "main.tf"
        _ = main_tf.write_text('resource "terraform_data" "x" {}\n')
        _git(repo, "commit", "-q", "-am", "drop backend")
        source_code = _source_code(repo)

        with pytest.raises(CannotProceed, match="has no backend block"):
            await _task(source_code, _run(source_code), _config(), tmp_path).start_pipeline()

    async def test_only_queued_runs_start(self, repo: Path, tmp_path: Path):
        source_code = _source_code(repo)
        run = _run(source_code, status=ModelStatus.DONE)

        with pytest.raises(Exception, match="cannot be started"):
            await _task(source_code, run, _config(), tmp_path).start_pipeline()


REGIONAL_MODULE = """
terraform {{
  backend "local" {{
    path = "{state}"
  }}
}}

variable "region" {{
  type = string
}}

resource "terraform_data" "dns" {{
  input = var.region
}}
"""


@pytest.fixture
def regional_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "regional"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "dev@example.com")
    _git(repo, "config", "user.name", "Dev")
    for region in ["eu-west-1", "us-east-1"]:
        folder = repo / "terraform" / "dns" / "prod" / region
        folder.mkdir(parents=True)
        _ = (folder / "main.tf").write_text(REGIONAL_MODULE.format(state=tmp_path / f"{region}.tfstate"))
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "add dns")
    return repo


class TestRegions:
    async def test_plans_one_region_with_the_region_passed_in(self, regional_repo: Path, tmp_path: Path):
        source_code = _source_code(regional_repo)
        run = _run(source_code, module_path="terraform/dns", environment_name="prod", region="us-east-1")
        # The module needs var.region, so the plan only succeeds when it is passed in.
        task = _task(source_code, run, _config(name="prod", region_variable="region"), tmp_path)

        await task.start_pipeline()

        assert run.status == ModelStatus.DONE
        assert (run.to_add, run.to_change, run.to_destroy) == (1, 0, 0)
        assert task.environment_variables["AWS_REGION"] == "us-east-1"
        assert task.environment_variables["TF_VAR_region"] == "us-east-1"
        assert (tmp_path / "us-east-1.tfstate").exists() is False  # a plan writes no state

    async def test_region_must_belong_to_the_environment(self, regional_repo: Path, tmp_path: Path):
        source_code = _source_code(regional_repo)
        run = _run(source_code, module_path="terraform/dns", environment_name="prod", region="ap-south-1")

        with pytest.raises(CannotProceed, match="is not deployed to ap-south-1"):
            await _task(source_code, run, _config(name="prod"), tmp_path).start_pipeline()

    async def test_regions_sharing_a_folder_need_a_storage(self, repo: Path, tmp_path: Path):
        source_code = _source_code(repo)
        # Declared regions run in the environment folder, whose backend block has a single state.
        run = _run(source_code, region="eu-west-1")
        config = _config(regions=["eu-west-1", "us-east-1"])

        with pytest.raises(CannotProceed, match="set a storage so each region gets its own state"):
            await _task(source_code, run, config, tmp_path).start_pipeline()
