from pathlib import Path

import pytest

from application.source_codes.iac import (
    IacModule,
    discover_iac_modules,
    is_environment_name,
    is_region_name,
    sort_environment_names,
)


def _write(root: Path, files: dict[str, str]) -> None:
    for path, content in files.items():
        file = root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        _ = file.write_text(content)


def _summary(modules: list[IacModule]) -> dict[str, dict[str, tuple[str, list[str]]]]:
    return {
        module.path: {env.name: (env.working_dir, env.var_files) for env in module.environments} for module in modules
    }


@pytest.mark.parametrize(
    ("name", "expected"),
    [("dev", True), ("prod-eu", True), ("eu_staging", True), ("production", True), ("redis", False), ("vpc", False)],
)
def test_is_environment_name(name: str, expected: bool):
    assert is_environment_name(name) is expected


def test_environment_folders_that_call_the_module(tmp_path: Path):
    _write(
        tmp_path,
        {
            "terraform/redis/main.tf": 'resource "x" "y" {}',
            "terraform/redis/dev/main.tf": 'module "redis" { source = "../" }',
            "terraform/redis/prod/main.tf": 'module "redis" { source = "../" }',
            "terraform/redis/prod/prod.tfvars": "size = 2",
            "terraform/vpc/dev/main.tf": 'resource "x" "y" {}',
            "terraform/vpc/staging/main.tf": 'resource "x" "y" {}',
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert [(m.name, m.path) for m in modules] == [("redis", "terraform/redis"), ("vpc", "terraform/vpc")]
    assert _summary(modules) == {
        "terraform/redis": {
            "dev": ("terraform/redis/dev", []),
            "prod": ("terraform/redis/prod", ["terraform/redis/prod/prod.tfvars"]),
        },
        "terraform/vpc": {"dev": ("terraform/vpc/dev", []), "staging": ("terraform/vpc/staging", [])},
    }


def test_environment_folders_calling_a_shared_module_folder(tmp_path: Path):
    _write(
        tmp_path,
        {
            "lib/redis/main.tf": 'resource "x" "y" {}',
            "stacks/redis/dev/main.tf": 'module "redis" { source = "../../../lib/redis" }',
            "stacks/redis/prod/main.tf": 'module "redis" { source = "../../../lib/redis" }',
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    # lib/redis is only used by others, so it is not runnable on its own.
    assert _summary(modules) == {
        "stacks/redis": {"dev": ("stacks/redis/dev", []), "prod": ("stacks/redis/prod", [])},
    }


def test_var_file_per_environment(tmp_path: Path):
    _write(
        tmp_path,
        {
            "infra/app/main.tf": "",
            "infra/app/common.tfvars": "",
            "infra/app/dev.tfvars": "",
            "infra/app/prod.tfvars": "",
            "infra/app/terraform.tfvars": "",
            "infra/app/extra.auto.tfvars": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    # Non-environment var files are passed to every environment; auto-loaded ones are left to tofu.
    assert _summary(modules) == {
        "infra/app": {
            "dev": ("infra/app", ["infra/app/common.tfvars", "infra/app/dev.tfvars"]),
            "prod": ("infra/app", ["infra/app/common.tfvars", "infra/app/prod.tfvars"]),
        },
    }


def test_environment_container_folder(tmp_path: Path):
    _write(
        tmp_path,
        {
            "app/main.tf": "",
            "app/envs/dev.tfvars": "",
            "app/envs/eu-west/a.tfvars": "",
            "app/envs/eu-west/b.tfvars": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert _summary(modules) == {
        "app": {
            "dev": ("app", ["app/envs/dev.tfvars"]),
            "eu-west": ("app", ["app/envs/eu-west/a.tfvars", "app/envs/eu-west/b.tfvars"]),
        },
    }


def test_environment_folders_holding_only_var_files(tmp_path: Path):
    _write(
        tmp_path,
        {
            "terraform/redis/main.tf": "",
            "terraform/redis/dev/vars.tfvars": "",
            "terraform/redis/prod/vars.tfvars": "",
            "terraform/redis/prod/README.md": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert _summary(modules) == {
        "terraform/redis": {
            "dev": ("terraform/redis", ["terraform/redis/dev/vars.tfvars"]),
            "prod": ("terraform/redis", ["terraform/redis/prod/vars.tfvars"]),
        },
    }


def test_sibling_modules_are_not_environments(tmp_path: Path):
    _write(
        tmp_path,
        {
            "aws/redis/main.tf": "",
            "aws/vpc/main.tf": "",
            "gcp/redis/main.tf": "",
            "gcp/vpc/main.tf": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    # redis and vpc repeat under aws and gcp, but nothing marks them as environments.
    assert _summary(modules) == {"aws/redis": {}, "aws/vpc": {}, "gcp/redis": {}, "gcp/vpc": {}}


def test_custom_environment_names_next_to_known_ones(tmp_path: Path):
    _write(
        tmp_path,
        {
            "a/prod/main.tf": "",
            "a/eu-west/main.tf": "",
            "b/prod/main.tf": "",
            "b/eu-west/main.tf": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert {path: sorted(envs) for path, envs in _summary(modules).items()} == {
        "a": ["eu-west", "prod"],
        "b": ["eu-west", "prod"],
    }


def test_environments_sorted_in_promotion_order(tmp_path: Path):
    _write(tmp_path, {f"svc/{env}/main.tf": "" for env in ["prod", "dev", "staging", "qa"]})

    modules = discover_iac_modules(str(tmp_path))

    assert [env.name for env in modules[0].environments] == ["dev", "qa", "staging", "prod"]


def test_skips_hidden_examples_and_tests(tmp_path: Path):
    _write(
        tmp_path,
        {
            "main.tf": "",
            ".terraform/modules/x/main.tf": "",
            "examples/basic/main.tf": "",
            "tests/unit/main.tf": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path), repository_name="tf-repo")

    assert [(m.name, m.path, m.environments) for m in modules] == [("tf-repo", "", [])]


def test_repository_without_terraform(tmp_path: Path):
    _write(tmp_path, {"README.md": "", "src/app.py": ""})

    assert discover_iac_modules(str(tmp_path)) == []


def test_sort_environment_names():
    assert sort_environment_names({"prod", "eu-west", "dev", "staging"}) == ["dev", "staging", "prod", "eu-west"]


@pytest.mark.parametrize(
    ("name", "expected"),
    [("eu-west-1", True), ("us-gov-west-1", True), ("ap-southeast-3", True), ("prod", False), ("eu-west", False)],
)
def test_is_region_name(name: str, expected: bool):
    assert is_region_name(name) is expected


def _regions(modules: list[IacModule]) -> dict[str, dict[str, dict[str, tuple[str, list[str]]]]]:
    return {
        module.path: {
            env.name: {region.name: (region.working_dir, region.var_files) for region in env.regions}
            for env in module.environments
        }
        for module in modules
    }


def test_region_folders_inside_environment_folders(tmp_path: Path):
    _write(
        tmp_path,
        {
            "terraform/redis/main.tf": "",
            "terraform/redis/dev/main.tf": 'module "redis" { source = "../" }',
            "terraform/redis/prod/common.tfvars": "",
            "terraform/redis/prod/eu-west-1/main.tf": 'module "redis" { source = "../../" }',
            "terraform/redis/prod/us-east-1/main.tf": 'module "redis" { source = "../../" }',
            "terraform/redis/prod/us-east-1/sizes.tfvars": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert _regions(modules) == {
        "terraform/redis": {
            "dev": {},
            "prod": {
                "eu-west-1": ("terraform/redis/prod/eu-west-1", ["terraform/redis/prod/common.tfvars"]),
                "us-east-1": (
                    "terraform/redis/prod/us-east-1",
                    ["terraform/redis/prod/common.tfvars", "terraform/redis/prod/us-east-1/sizes.tfvars"],
                ),
            },
        }
    }


def test_region_var_files_in_an_environment_folder(tmp_path: Path):
    _write(
        tmp_path,
        {
            "terraform/redis/prod/main.tf": "",
            "terraform/redis/prod/prod.tfvars": "",
            "terraform/redis/prod/eu-west-1.tfvars": "",
            "terraform/redis/prod/us-east-1/vars.tfvars": "",
            "terraform/redis/dev/main.tf": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    prod = next(env for env in modules[0].environments if env.name == "prod")
    assert prod.var_files == ["terraform/redis/prod/prod.tfvars"]
    assert _regions(modules)["terraform/redis"]["prod"] == {
        "eu-west-1": (
            "terraform/redis/prod",
            ["terraform/redis/prod/prod.tfvars", "terraform/redis/prod/eu-west-1.tfvars"],
        ),
        "us-east-1": (
            "terraform/redis/prod",
            ["terraform/redis/prod/prod.tfvars", "terraform/redis/prod/us-east-1/vars.tfvars"],
        ),
    }


def test_region_var_files_in_an_environment_container(tmp_path: Path):
    _write(
        tmp_path,
        {
            "app/main.tf": "",
            "app/envs/prod/common.tfvars": "",
            "app/envs/prod/eu-west-1.tfvars": "",
            "app/envs/prod/us-east-1.tfvars": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert _regions(modules) == {
        "app": {
            "prod": {
                "eu-west-1": ("app", ["app/envs/prod/common.tfvars", "app/envs/prod/eu-west-1.tfvars"]),
                "us-east-1": ("app", ["app/envs/prod/common.tfvars", "app/envs/prod/us-east-1.tfvars"]),
            }
        }
    }


def test_regions_of_a_module_without_environments(tmp_path: Path):
    _write(tmp_path, {"global/dns/eu-west-1/main.tf": "", "global/dns/us-east-1/main.tf": ""})

    modules = discover_iac_modules(str(tmp_path))

    assert [(m.path, [e.name for e in m.environments]) for m in modules] == [("global/dns", ["default"])]
    assert sorted(_regions(modules)["global/dns"]["default"]) == ["eu-west-1", "us-east-1"]


def test_region_folders_are_not_environments_or_modules(tmp_path: Path):
    _write(
        tmp_path,
        {
            "a/prod/eu-west-1/main.tf": "",
            "a/prod/us-east-1/main.tf": "",
            "b/prod/eu-west-1/main.tf": "",
        },
    )

    modules = discover_iac_modules(str(tmp_path))

    assert [(m.path, [e.name for e in m.environments]) for m in modules] == [("a", ["prod"]), ("b", ["prod"])]


def test_variables_of_the_folders_a_module_runs_in(tmp_path: Path):
    _write(
        tmp_path,
        {
            "terraform/redis/dev/variables.tf": (
                'variable "size" {\n  type        = number\n  description = "Node count"\n}\n'
                'variable "tags" {\n  type    = map(string)\n  default = {}\n}\n'
            ),
            "terraform/redis/prod/variables.tf": 'variable "password" {\n  type      = string\n  sensitive = true\n}\n',
            "terraform/redis/prod/broken.tf": 'variable "x" {',
        },
    )

    (module,) = discover_iac_modules(str(tmp_path))

    assert [variable.model_dump() for variable in module.variables] == [
        {"name": "password", "type": "string", "description": "", "required": True, "sensitive": True},
        {"name": "size", "type": "number", "description": "Node count", "required": True, "sensitive": False},
        {"name": "tags", "type": "map(string)", "description": "", "required": False, "sensitive": False},
    ]
