import pytest

from application.iac.functions import PlanSummary, environment_regions, parse_plan_summary, run_variables, state_path
from application.source_codes.iac import IacEnvironment, IacRegion


@pytest.mark.parametrize(
    ("output", "expected"),
    [
        ("...\nPlan: 1 to add, 2 to change, 3 to destroy.\n", PlanSummary(1, 2, 3)),
        ("Plan: 2 to import, 1 to add, 0 to change, 0 to destroy.", PlanSummary(1, 0, 0)),
        ("\x1b[1mPlan:\x1b[0m 4 to add, 0 to change, 1 to destroy.", PlanSummary(4, 0, 1)),
        ("No changes. Your infrastructure matches the configuration.", PlanSummary(0, 0, 0)),
        ("Error: something broke", None),
    ],
)
def test_parse_plan_summary(output: str, expected: PlanSummary | None):
    assert parse_plan_summary(output) == expected


@pytest.mark.parametrize(
    ("template", "module_path", "expected"),
    [
        ("{module}/{env}.tfstate", "terraform/redis", "terraform/redis/dev.tfstate"),
        ("states/{module_name}-{env}.tfstate", "terraform/redis", "states/redis-dev.tfstate"),
        # A module at the repository root uses its name.
        ("{module}/{env}.tfstate", "", "repo/dev.tfstate"),
        ("/{module}//{env}.tfstate", "terraform/redis", "terraform/redis/dev.tfstate"),
    ],
)
def test_state_path(template: str, module_path: str, expected: str):
    name = module_path.rsplit("/", 1)[-1] if module_path else "repo"
    assert state_path(template, module_path, name, "dev") == expected


@pytest.mark.parametrize(
    ("template", "expected"),
    [
        # Without {region}, the region goes before the file name so regions never share a state.
        ("{module}/{env}.tfstate", "terraform/redis/prod/eu-west-1.tfstate"),
        ("{env}/{region}/{module_name}.tfstate", "prod/eu-west-1/redis.tfstate"),
    ],
)
def test_state_path_with_region(template: str, expected: str):
    assert state_path(template, "terraform/redis", "redis", "prod", "eu-west-1") == expected


def test_discovered_regions_take_precedence():
    discovered = IacRegion(name="eu-west-1", working_dir="m/prod/eu-west-1")
    environment = IacEnvironment(name="prod", working_dir="m/prod", regions=[discovered])

    assert environment_regions(environment, ["us-east-1"]) == [discovered]


def test_declared_regions_run_in_the_environment_folder():
    environment = IacEnvironment(name="prod", working_dir="m/prod", var_files=["m/prod/prod.tfvars"])

    assert environment_regions(environment, ["eu-west-1"]) == [
        IacRegion(name="eu-west-1", working_dir="m/prod", var_files=["m/prod/prod.tfvars"])
    ]
    assert environment_regions(environment, None) == []


def test_run_variables_region_values_win():
    variables = {"account_id": "123", "vpc_cidr": "10.0.0.0/16"}
    region_variables = {"us-east-1": {"vpc_cidr": "10.1.0.0/16"}}

    assert run_variables(variables, region_variables, "us-east-1") == {
        "TF_VAR_account_id": "123",
        "TF_VAR_vpc_cidr": "10.1.0.0/16",
    }
    assert run_variables(variables, region_variables, "eu-west-1")["TF_VAR_vpc_cidr"] == "10.0.0.0/16"
    assert run_variables(variables, region_variables, None)["TF_VAR_vpc_cidr"] == "10.0.0.0/16"
    assert run_variables(None, None, None) == {}
