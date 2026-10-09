"""Discovery of the runnable Terraform/OpenTofu modules of an IaC repository and their environments.

The layout is inferred from the folder structure and the .tf files, so no folder name such as
``modules/`` is assumed. Supported layouts (``terraform/redis`` is just an example path):

- environment folders, each a root of its own: ``terraform/redis/dev/main.tf``, ``terraform/redis/prod/main.tf``
- var files per environment in the module: ``terraform/redis/dev.tfvars`` or ``terraform/redis/envs/dev.tfvars``
- environment folders that hold only var files: ``terraform/redis/main.tf`` + ``terraform/redis/dev/vars.tfvars``
- a module without environments

Each environment can be deployed to several AWS regions, found the same way:

- region folders, each a root of its own: ``terraform/redis/prod/eu-west-1/main.tf``
- a var file per region: ``terraform/redis/prod/eu-west-1.tfvars`` or ``terraform/redis/prod/eu-west-1/*.tfvars``
"""

import logging
import os
import posixpath
import re
from collections import defaultdict
from typing import Any

import hcl2
from pydantic import BaseModel, Field

from application.tools.tf_parser import HclVariableParser

logger = logging.getLogger(__name__)

# Folders that never hold runnable code; hidden folders (.git, .terraform, ...) are skipped too.
DEFAULT_SKIP_FOLDERS = frozenset({"examples", "example", "test", "tests", "node_modules"})

# Folder holding per-environment var files, e.g. terraform/redis/envs/dev.tfvars.
ENV_CONTAINER_FOLDERS = frozenset({"env", "envs", "environment", "environments", "vars", "tfvars"})

# Words that mark a folder or var file as an environment, in promotion order (used for sorting).
ENV_TOKENS = (
    "sandbox",
    "sbx",
    "dev",
    "develop",
    "development",
    "int",
    "integration",
    "test",
    "testing",
    "qa",
    "nonprod",
    "perf",
    "demo",
    "stage",
    "staging",
    "stg",
    "uat",
    "preprod",
    "prod",
    "production",
    "prd",
)

# Environment name of a module that is run without environments.
DEFAULT_ENVIRONMENT_NAME = "default"

# AWS region names, e.g. eu-west-1, us-gov-west-1, ap-southeast-3.
_REGION = re.compile(
    r"^(af|ap|ca|cn|eu|il|me|mx|sa|us)(-gov|-iso[a-z]?)?"
    r"-(north|south|east|west|central|northeast|northwest|southeast|southwest)-\d+$"
)

_LOCAL_SOURCE = re.compile(r"""\bsource\s*=\s*"(\.{1,2}/[^"]*)\"""")
_TFVARS_SUFFIXES = (".tfvars", ".tfvars.json")


class IacRegion(BaseModel):
    name: str
    # Folder to run tofu in, relative to the repository root.
    working_dir: str
    # Var files to pass with -var-file (those of the environment included), relative to the repository root.
    var_files: list[str] = Field(default_factory=list)


class IacEnvironment(BaseModel):
    name: str
    # Folder to run tofu in, relative to the repository root ("" is the root).
    working_dir: str
    # Var files to pass with -var-file, relative to the repository root.
    var_files: list[str] = Field(default_factory=list)
    # Regions the environment is deployed to; empty when it is run once, without a region.
    regions: list[IacRegion] = Field(default_factory=list)


class IacVariable(BaseModel):
    name: str
    type: str = "any"
    description: str = ""
    # No default, so every run needs a value for it.
    required: bool = False
    sensitive: bool = False


class IacModule(BaseModel):
    name: str
    # Folder of the module, relative to the repository root ("" is the root).
    path: str
    # Empty for a module that is run as is, without environments.
    environments: list[IacEnvironment] = Field(default_factory=list)
    # Variables declared in the folders the module is run in.
    variables: list[IacVariable] = Field(default_factory=list)


def is_region_name(name: str) -> bool:
    return _REGION.match(name) is not None


def _tokens(name: str) -> list[str]:
    return [token for token in re.split(r"[-_.\s]+", name.lower()) if token]


def is_environment_name(name: str) -> bool:
    return any(token in ENV_TOKENS for token in _tokens(name))


def _environment_rank(name: str) -> tuple[int, str]:
    ranks = [ENV_TOKENS.index(token) for token in _tokens(name) if token in ENV_TOKENS]
    return (min(ranks) if ranks else len(ENV_TOKENS), name)


def sort_environment_names(names: set[str] | list[str]) -> list[str]:
    """Environment names in promotion order (dev before staging before prod), unknown names last."""
    return sorted(set(names), key=_environment_rank)


def _var_file_stem(file_name: str) -> str:
    for suffix in _TFVARS_SUFFIXES:
        if file_name.endswith(suffix):
            return file_name.removesuffix(suffix)
    return file_name


def _is_env_var_file(file_name: str) -> bool:
    # terraform.tfvars and *.auto.tfvars are loaded by tofu itself, so they are not environment specific.
    if not file_name.endswith(_TFVARS_SUFFIXES) or file_name.startswith("terraform.tfvars"):
        return False
    return ".auto." not in file_name


class _RepositoryScan:
    def __init__(self, root: str, skip_folders: frozenset[str]) -> None:
        # Repository-relative folder -> names of its files and child folders.
        self.files: dict[str, list[str]] = {}
        self.children: dict[str, list[str]] = {}
        self.local_sources: set[str] = set()

        for current, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d not in skip_folders)
            folder = os.path.relpath(current, root).replace(os.sep, "/")
            folder = "" if folder == "." else folder
            self.files[folder] = sorted(files)
            self.children[folder] = list(dirs)
            for file_name in files:
                if file_name.endswith(".tf"):
                    self._read_local_sources(os.path.join(current, file_name), folder)

    def _read_local_sources(self, file_path: str, folder: str) -> None:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            content = f.read()
        for source in _LOCAL_SOURCE.findall(content):
            target = posixpath.normpath(posixpath.join(folder, source.split("?", 1)[0]))
            self.local_sources.add("" if target == "." else target)

    @property
    def terraform_folders(self) -> set[str]:
        return {folder for folder, files in self.files.items() if any(f.endswith(".tf") for f in files)}

    def var_files(self, folder: str) -> list[str]:
        return [posixpath.join(folder, f) for f in self.files.get(folder, []) if _is_env_var_file(f)]


def _environment_folders(roots: set[str]) -> dict[str, list[str]]:
    """Parent folder -> its root children that are environments, e.g. terraform/redis -> [dev, prod].

    A child counts as an environment when its name says so (dev, prod-eu, ...), or when the same
    name repeats under several parents that each also have such an environment child
    (so custom names like "eu-west" next to "prod" are picked up).
    """
    by_parent: dict[str, list[str]] = defaultdict(list)
    for root in roots:
        if root:
            parent, name = posixpath.split(root)
            by_parent[parent].append(name)

    with_env_child = {parent for parent, names in by_parent.items() if any(map(is_environment_name, names))}
    parents_by_name: dict[str, set[str]] = defaultdict(set)
    for parent in with_env_child:
        for name in by_parent[parent]:
            parents_by_name[name].add(parent)

    def is_env(name: str) -> bool:
        return is_environment_name(name) or len(parents_by_name.get(name, ())) >= 2

    return {
        parent: sorted((name for name in names if is_env(name)), key=_environment_rank)
        for parent, names in by_parent.items()
        if parent in with_env_child
    }


def _var_file_environments(scan: _RepositoryScan, module: str, roots: set[str]) -> list[IacEnvironment]:
    """Environments of a module that is run as one root with a var file per environment."""
    shared: list[str] = []
    found: dict[str, list[str]] = defaultdict(list)

    for path in scan.var_files(module):
        stem = _var_file_stem(posixpath.basename(path))
        if is_environment_name(stem):
            found[stem].append(path)
        else:
            shared.append(path)

    for child in scan.children.get(module, []):
        child_path = posixpath.join(module, child)
        if child_path in roots:
            continue
        if child in ENV_CONTAINER_FOLDERS:
            # envs/dev.tfvars or envs/dev/*.tfvars
            for path in scan.var_files(child_path):
                found[_var_file_stem(posixpath.basename(path))].append(path)
            for env in scan.children.get(child_path, []):
                found[env].extend(scan.var_files(posixpath.join(child_path, env)))
        elif is_environment_name(child):
            # dev/*.tfvars next to the module's own .tf files
            found[child].extend(scan.var_files(child_path))

    return [
        IacEnvironment(name=name, working_dir=module, var_files=[*shared, *sorted(files)])
        for name, files in sorted(found.items(), key=lambda item: _environment_rank(item[0]))
        if files
    ]


def _with_regions(
    scan: _RepositoryScan,
    environment: IacEnvironment,
    region_folders: dict[str, list[str]],
    roots: set[str],
    own_folder: bool,
) -> IacEnvironment:
    """Add the regions of an environment, found from region folders or region var files.

    ``own_folder`` is true when the working directory belongs to this environment alone, so
    region folders holding only var files can be read from it.
    """
    if environment.working_dir in region_folders:
        # Region folders are roots of their own; the environment's var files apply to each of them.
        regions = [
            IacRegion(
                name=name,
                working_dir=posixpath.join(environment.working_dir, name),
                var_files=[*environment.var_files, *scan.var_files(posixpath.join(environment.working_dir, name))],
            )
            for name in sorted(region_folders[environment.working_dir])
        ]
        return environment.model_copy(update={"regions": regions})

    shared = [f for f in environment.var_files if not is_region_name(_var_file_stem(posixpath.basename(f)))]
    found: dict[str, list[str]] = defaultdict(list)
    for path in environment.var_files:
        stem = _var_file_stem(posixpath.basename(path))
        if is_region_name(stem):
            found[stem].append(path)
    if own_folder:
        for child in scan.children.get(environment.working_dir, []):
            child_path = posixpath.join(environment.working_dir, child)
            if is_region_name(child) and child_path not in roots:
                found[child].extend(scan.var_files(child_path))

    regions = [
        IacRegion(name=name, working_dir=environment.working_dir, var_files=[*shared, *sorted(files)])
        for name, files in sorted(found.items())
        if files
    ]
    if not regions:
        return environment
    return environment.model_copy(update={"var_files": shared, "regions": regions})


def _read_variables(root: str, scan: _RepositoryScan, folders: list[str]) -> list[IacVariable]:
    variables: dict[str, IacVariable] = {}
    for folder in folders:
        for file_name in scan.files.get(folder, []):
            if not file_name.endswith(".tf"):
                continue
            with open(os.path.join(root, folder, file_name), encoding="utf-8", errors="replace") as f:
                content = f.read()
            if "variable" not in content:
                continue
            try:
                data: dict[str, Any] = hcl2.loads(
                    content,
                    serialization_options=hcl2.SerializationOptions(strip_string_quotes=True, explicit_blocks=False),
                )
            except Exception as e:
                logger.warning(f"Could not read the variables of {posixpath.join(folder, file_name)}: {e}")
                continue
            types = HclVariableParser.extract_variable_types(content)
            for block in data.get("variable", []):
                for name, config in block.items():
                    if name in variables or not isinstance(config, dict):
                        continue
                    variables[name] = IacVariable(
                        name=name,
                        type=types.get(name, "any"),
                        description=str(config.get("description") or ""),
                        required="default" not in config,
                        sensitive=config.get("sensitive") is True,
                    )
    return [variables[name] for name in sorted(variables)]


def _run_folders(module: IacModule) -> list[str]:
    if not module.environments:
        return [module.path]
    folders = [
        folder
        for env in module.environments
        for folder in [env.working_dir, *(region.working_dir for region in env.regions)]
    ]
    return list(dict.fromkeys(folders))


def _module_name(path: str, repository_name: str) -> str:
    return posixpath.basename(path) if path else repository_name


def discover_iac_modules(
    root: str,
    repository_name: str = "root",
    skip_folders: frozenset[str] = DEFAULT_SKIP_FOLDERS,
) -> list[IacModule]:
    """Find the runnable modules of a checked out repository and the environments each is run with."""
    scan = _RepositoryScan(root, skip_folders)
    # Folders used by others through a local `source = "../x"` are building blocks, not roots.
    roots = scan.terraform_folders - scan.local_sources

    # Region folders that are roots are run per region; their parent takes their place as the
    # folder of the environment (or of the module, when it has no environments).
    region_folders: dict[str, list[str]] = defaultdict(list)
    for root_folder in roots:
        parent, name = posixpath.split(root_folder)
        if root_folder and is_region_name(name):
            region_folders[parent].append(name)
    region_roots = {posixpath.join(parent, name) for parent, names in region_folders.items() for name in names}
    roots = (roots - region_roots) | set(region_folders)

    modules: dict[str, IacModule] = {}
    grouped: set[str] = set()
    for parent, env_names in _environment_folders(roots).items():
        if not env_names:
            continue
        environments = []
        for env in env_names:
            working_dir = posixpath.join(parent, env)
            grouped.add(working_dir)
            environment = IacEnvironment(name=env, working_dir=working_dir, var_files=scan.var_files(working_dir))
            environments.append(_with_regions(scan, environment, region_folders, roots, own_folder=True))
        modules[parent] = IacModule(name=_module_name(parent, repository_name), path=parent, environments=environments)

    for root_folder in sorted(roots - grouped):
        environments = [
            _with_regions(scan, env, region_folders, roots, own_folder=False)
            for env in _var_file_environments(scan, root_folder, roots)
        ]
        if not environments:
            # No environments, but maybe regions: run them under the default environment.
            default = _with_regions(
                scan,
                IacEnvironment(
                    name=DEFAULT_ENVIRONMENT_NAME, working_dir=root_folder, var_files=scan.var_files(root_folder)
                ),
                region_folders,
                roots,
                own_folder=True,
            )
            environments = [default] if default.regions else []
        if root_folder in modules:
            # Both environment folders and var files; keep the folders and add the rest.
            known = {env.name for env in modules[root_folder].environments}
            modules[root_folder].environments.extend(env for env in environments if env.name not in known)
            continue
        modules[root_folder] = IacModule(
            name=_module_name(root_folder, repository_name), path=root_folder, environments=environments
        )

    for module in modules.values():
        module.variables = _read_variables(root, scan, _run_folders(module))
    return [modules[path] for path in sorted(modules)]
