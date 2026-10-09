import posixpath
import re
from typing import NamedTuple

from application.source_codes.iac import DEFAULT_ENVIRONMENT_NAME, IacEnvironment, IacModule, IacRegion

_ANSI = re.compile(r"\x1b\[[0-9;]*m")
_PLAN_LINE = re.compile(r"^Plan: .*$", re.MULTILINE)
_COUNT = re.compile(r"(\d+) to (add|change|destroy)")


class PlanSummary(NamedTuple):
    to_add: int
    to_change: int
    to_destroy: int


def parse_plan_summary(output: str) -> PlanSummary | None:
    """Read the resource counts from `tofu plan` output, None when there is no summary line."""
    output = _ANSI.sub("", output)
    if "No changes." in output:
        return PlanSummary(0, 0, 0)
    line = _PLAN_LINE.search(output)
    if line is None:
        return None
    counts = {action: int(count) for count, action in _COUNT.findall(line.group(0))}
    return PlanSummary(counts.get("add", 0), counts.get("change", 0), counts.get("destroy", 0))


def state_path(
    template: str, module_path: str, module_name: str, environment_name: str, region: str | None = None
) -> str:
    """The state key of a module in an environment (and region), e.g. "terraform/redis/prod/eu-west-1.tfstate".

    When a run has a region and the template does not use {region}, the region is added before
    the file name, so the regions of an environment never share a state.
    """
    path = template.format(
        module=module_path or module_name, module_name=module_name, env=environment_name, region=region or ""
    )
    path = "/".join(part for part in path.split("/") if part)
    if region and "{region}" not in template:
        folder, file_name = posixpath.split(path)
        stem, extension = posixpath.splitext(file_name)
        path = posixpath.join(folder, stem, f"{region}{extension}")
    return path


def find_environment(module: IacModule, environment_name: str) -> IacEnvironment | None:
    """An environment of a module; a module without environments is run as the default one."""
    if not module.environments and environment_name == DEFAULT_ENVIRONMENT_NAME:
        return IacEnvironment(name=DEFAULT_ENVIRONMENT_NAME, working_dir=module.path)
    return next((env for env in module.environments if env.name == environment_name), None)


def environment_regions(environment: IacEnvironment, declared_regions: list[str] | None) -> list[IacRegion]:
    """Regions an environment is run in: the discovered ones, else those declared in its settings."""
    if environment.regions:
        return environment.regions
    return [
        IacRegion(name=region, working_dir=environment.working_dir, var_files=environment.var_files)
        for region in declared_regions or []
    ]


def run_variables(
    variables: dict[str, str] | None, region_variables: dict[str, dict[str, str]] | None, region: str | None
) -> dict[str, str]:
    """The TF_VAR_ environment variables of a run; values of its region replace those of the environment."""
    merged = dict(variables or {})
    if region is not None:
        merged.update((region_variables or {}).get(region, {}))
    return {f"TF_VAR_{name}": value for name, value in merged.items()}
