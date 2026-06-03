import logging
import os
import posixpath
import re
from typing import Any, NamedTuple

import aiofiles
import hcl2
from aiofiles.os import listdir, path

logger = logging.getLogger(__name__)


class ModuleRef(NamedTuple):
    source: str
    ref: str | None
    subpath: str


class HclVariableParser:
    """Parse HCL variable definitions."""

    VARIABLE_PATTERN = re.compile(r'^\s*variable\s+"([^"]+)"\s*\{')
    TYPE_PATTERN = re.compile(r"^\s*type\s*=")

    @staticmethod
    def extract_variable_types(tf_data: str) -> dict[str, str]:
        """Extract original variable types from raw HCL."""
        if not tf_data.strip():
            return {}

        lines = tf_data.splitlines()
        variables = {}
        i = 0

        while i < len(lines):
            line = lines[i]

            # Extract variable name and validate it's a proper variable declaration
            match = HclVariableParser.VARIABLE_PATTERN.match(line)
            if not match:
                i += 1
                continue

            var_name = match.group(1)

            # Find the variable block and extract type
            i, type_def = HclVariableParser._parse_variable_block(lines, i)
            if type_def:
                variables[var_name] = type_def

        return variables

    @staticmethod
    def _parse_variable_block(lines: list[str], start_idx: int) -> tuple[int, str | None]:
        """Parse a variable block and return the end index and type definition."""
        brace_count = 1 if "{" in lines[start_idx] else 0
        i = start_idx + 1
        type_def = None

        while i < len(lines) and brace_count > 0:
            line = lines[i]

            # Check for type definition
            if type_def is None and HclVariableParser.TYPE_PATTERN.match(line):
                type_def = HclVariableParser._extract_complete_type(lines, i)

            brace_count += line.count("{") - line.count("}")
            i += 1

        return i, type_def

    @staticmethod
    def _extract_complete_type(lines: list[str], type_line_idx: int) -> str:
        """Extract complete type definition, handling multi-line types."""
        line = lines[type_line_idx]
        type_value = line.split("=", 1)[1].strip()

        # Single-line type
        if not (type_value.endswith("{") or type_value.endswith("(")):
            return type_value

        # Multi-line type
        result = [type_value]
        brace_balance = type_value.count("{") + type_value.count("(") - type_value.count("}") - type_value.count(")")
        indent = 1

        for line in lines[type_line_idx + 1 :]:
            if brace_balance <= 0:
                break

            stripped = line.lstrip()
            if not stripped:
                continue

            # Handle indentation
            if stripped.startswith("}") or stripped.startswith(")"):
                indent = max(0, indent - 1)

            result.append("  " * indent + stripped)

            if stripped.endswith("{") or stripped.endswith("("):
                indent += 1

            brace_balance += line.count("{") + line.count("(") - line.count("}") - line.count(")")

        return "\n".join(result)


class OtfProvider:
    """Main class for handling OpenTofu/Terraform operations."""

    # Terraform treats a module source as a local path only when it begins with
    # "./" or "../"; anything else is a registry/git/external reference.
    LOCAL_MODULE_PREFIXES = ("./", "../")

    # Used as the per-file divider in `tf_string_data`. The `{}` is filled with
    # the file's display name.
    _FILE_DIVIDER = f"\n# {'-' * 30} FILE: {{}} {'-' * 30} \n"

    # Matches a git repo URL in any of the common shapes:
    #   https://github.com/foo/bar.git, ssh://git@github.com/foo/bar.git,
    #   git@github.com:foo/bar.git, github.com/foo/bar
    _REPO_URL_RE = re.compile(
        r"^(?:[a-z][a-z0-9+.-]*://)?(?:[^@/]+@)?([^/:?#]+)[:/]([^?#]+?)(?:\.git)?/?$",
        re.IGNORECASE,
    )

    def __init__(
        self,
        workspace,
        repo_root: str | None = None,
        repo_url: str | None = None,
        source_code_ref: str | None = None,
        git_client: Any = None,
        follow_modules: bool = False,
    ) -> None:
        self.workspace: str = workspace
        self.repo_root: str = os.path.abspath(repo_root or workspace)
        self.repo_url: str | None = repo_url
        self.repo_id: str | None = self._normalize_repo_id(repo_url) if repo_url else None
        self.source_code_ref: str | None = source_code_ref
        self.git_client: Any = git_client
        # Opt-in: when True, `read_files_to_string` follows `module` references
        # SourceCodeVersions want to follow the modules in the terraform files
        # while Resources and Executors only care about the current directory.
        self.follow_modules: bool = follow_modules
        self.depth: int = 1  # Depth of the directory tree when adding files
        self.directory: str | None = None
        self.tf_string_data: str = ""

    @classmethod
    def _normalize_repo_id(cls, url: str) -> str | None:
        """Reduce a git URL to a "host/owner/repo" identifier, stripping
        scheme, user, .git suffix, trailing slash. Returns None if it doesn't
        look like a git repo URL."""
        if not url:
            return None
        s = url.strip().removeprefix("git::")
        s = s.split("?", 1)[0]
        match = cls._REPO_URL_RE.match(s)
        if not match:
            return None
        host, path = match.group(1), match.group(2)
        return f"{host.lower()}/{path}"

    def parse_tf_to_json(self, tf_data: str) -> dict[str, Any]:
        dict_data: dict[str, Any] = hcl2.loads(
            tf_data,
            serialization_options=hcl2.SerializationOptions(strip_string_quotes=True, explicit_blocks=False),
        )

        variables = dict_data.get("variable", [])
        if not variables:
            return dict_data

        original_types = HclVariableParser.extract_variable_types(tf_data)

        for variable in variables:
            for var_name, var_config in variable.items():
                if var_name in original_types:
                    var_config["original_type"] = original_types[var_name]

        return dict_data

    @staticmethod
    def list_to_dict(list_data: list[dict[str, Any]]) -> dict[str, Any]:
        result = {}
        for item in list_data:
            for key, value in item.items():
                result[key] = value
        return result

    @staticmethod
    def remap_variable_types(variables: dict[str, Any]) -> dict[str, Any]:
        # use JS types
        for _, value in variables.items():
            match value.get("type"):
                case "string":
                    value["type"] = "string"
                case "bool":
                    value["type"] = "boolean"
                case "number":
                    value["type"] = "number"
                case None:
                    value["type"] = "any"
                case _:
                    if "list(map" in value["type"]:
                        value["type"] = "array[object]"
                    elif "list(object" in value["type"]:
                        value["type"] = "array[object]"
                    elif "object(" in value["type"]:
                        value["type"] = "object"
                    elif "map(" in value["type"]:
                        value["type"] = "object"
                    elif "list(string" in value["type"]:
                        value["type"] = "array[string]"
                    else:
                        value["type"] = "any"
        return variables

    async def traverse_directories(self, files: list[str], directory: str | None = None, count: int = 0) -> None:
        """Recursively traverse all directories starting from 'directory'."""
        directory = directory or self.workspace
        for name in await listdir(directory):
            full_path = os.path.join(directory, name)
            if await path.isdir(full_path):
                if count < self.depth:
                    await self.traverse_directories(files, directory=full_path, count=count + 1)
            else:
                files.append(full_path)

    async def read_file_to_string(self, file_path: str) -> str:
        """Read a file's content into a string."""
        async with aiofiles.open(file_path) as file:
            data = await file.read()
        return data

    def _parse_same_repo_git_source(self, source: str) -> tuple[str, str | None] | None:
        """If `source` is a `git::...//subpath[?ref=...]` reference whose repo
        matches this OtfProvider's `repo_url`, return `(subpath, ref)`.
        """
        if not self.repo_id or not source.startswith("git::"):
            return None

        # Split off the ref query first so it doesn't confuse URL parsing.
        body, _, query = source.removeprefix("git::").partition("?")
        ref: str | None = None
        if query:
            for param in query.split("&"):
                if param.startswith("ref="):
                    ref = param[len("ref=") :]
                    break

        body_no_scheme = body.split("://", 1)[1] if "://" in body else body
        if "//" not in body_no_scheme:
            return None

        repo_part, subpath = body_no_scheme.split("//", 1)
        if self._normalize_repo_id(repo_part) != self.repo_id:
            return None

        return subpath.strip("/"), ref

    def _extract_module_refs(self, tf_data: str, parent_subpath: str, parent_ref: str | None) -> list[ModuleRef]:
        try:
            dict_data: dict[str, Any] = hcl2.loads(
                tf_data,
                serialization_options=hcl2.SerializationOptions(strip_string_quotes=True, explicit_blocks=False),
            )
        except Exception:
            return []

        results: list[ModuleRef] = []
        for block in dict_data.get("module", []):
            if not isinstance(block, dict):
                continue
            for module_config in block.values():
                source = module_config.get("source") if isinstance(module_config, dict) else None
                if not isinstance(source, str):
                    continue

                if source.startswith(self.LOCAL_MODULE_PREFIXES):
                    new_subpath = posixpath.normpath(posixpath.join(parent_subpath, source))
                    if new_subpath.startswith("..") or new_subpath == ".":
                        continue
                    results.append(ModuleRef(source, parent_ref, new_subpath))
                    continue

                git_match = self._parse_same_repo_git_source(source)
                if git_match is None:
                    continue
                subpath, ref = git_match
                # No `?ref=` → Terraform pulls the default branch tip; mirror that.
                results.append(ModuleRef(source, ref or "HEAD", subpath))
        return results

    @staticmethod
    async def _list_tf_files(directory: str) -> list[str]:
        if not await path.isdir(directory):
            return []
        return [os.path.join(directory, name) for name in await listdir(directory) if name.endswith(".tf")]

    async def read_files_to_string(self) -> None:
        initial_files: list[str] = []
        await self.traverse_directories(initial_files, self.workspace)

        visited: set[tuple[str | None, str]] = set()
        queue: list[ModuleRef] = []

        for f in initial_files:
            if not f.endswith(".tf"):
                continue
            rel = os.path.relpath(f, self.repo_root).replace(os.sep, "/")
            parent_subpath = posixpath.dirname(rel) or "."
            visited.add((self.source_code_ref, parent_subpath))
            content = await self.read_file_to_string(f)
            display = f"{rel}@{self.source_code_ref}" if self.source_code_ref else rel
            self.tf_string_data += self._FILE_DIVIDER.format(display)
            self.tf_string_data += content + "\n"
            if self.follow_modules:
                queue.extend(self._extract_module_refs(content, parent_subpath, self.source_code_ref))

        while queue:
            mod = queue.pop(0)
            key = (mod.ref, mod.subpath)
            if key in visited:
                continue
            visited.add(key)

            if mod.ref == self.source_code_ref:
                abs_dir = os.path.join(self.repo_root, mod.subpath)
                tf_files = await self._list_tf_files(abs_dir)
                logger.info(f"[tf_parser] including module '{mod.source}' -> {mod.subpath} ({len(tf_files)} .tf files)")
                for tf_file in tf_files:
                    content = await self.read_file_to_string(tf_file)
                    rel = os.path.relpath(tf_file, self.repo_root).replace(os.sep, "/")
                    display = f"{rel}@{mod.ref}" if mod.ref else rel
                    self.tf_string_data += self._FILE_DIVIDER.format(display)
                    self.tf_string_data += content + "\n"
                    queue.extend(self._extract_module_refs(content, mod.subpath, mod.ref))
                continue

            if self.git_client is None:
                raise RuntimeError(
                    f"Module '{mod.source}' pins ref={mod.ref!r} which differs from the "
                    f"snapshot ref {self.source_code_ref!r}, but OtfProvider was constructed without a "
                    f"git_client to fetch it. Cannot build a correct snapshot."
                )
            sha = await self.git_client.fetch_ref(mod.ref)
            file_paths = await self.git_client.list_files_at_ref(sha, mod.subpath)
            tf_files = [p for p in file_paths if p.endswith(".tf")]
            logger.info(
                f"[tf_parser] including pinned module '{mod.source}' -> {mod.subpath}@{mod.ref} "
                f"({len(tf_files)} .tf files)"
            )
            for repo_path in tf_files:
                content = await self.git_client.read_file_at_ref(sha, repo_path)
                display = f"{repo_path}@{mod.ref}"
                self.tf_string_data += self._FILE_DIVIDER.format(display)
                self.tf_string_data += content + "\n"
                queue.extend(self._extract_module_refs(content, posixpath.dirname(repo_path), mod.ref))

    async def parse_tf_directory_to_json(self):
        """Parse all Terraform files in a given folder to JSON."""
        await self.read_files_to_string()
        return self.parse_tf_to_json(self.tf_string_data)

    async def setup_tf_backend(self, tf_data: dict[str, Any], integration_provider: str) -> None:
        terraform_config = self.list_to_dict(tf_data.get("terraform", []))
        backend_config = terraform_config.get("backend")

        if backend_config:
            return

        backend_tf_path = os.path.join(self.workspace, "ik_temp_backend.tf")
        if os.path.exists(backend_tf_path):
            raise FileExistsError(f"Backend file already exists: {backend_tf_path}")

        backend_content = get_backend_content(integration_provider)
        async with aiofiles.open(backend_tf_path, "w") as f:
            await f.write(backend_content)


def get_backend_content(integration_provider: str) -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    configs_dir = os.path.join(base_dir, "../utils/templates/tf_backends")
    if integration_provider == "aws":
        file_path = os.path.join(configs_dir, "backend_aws.tf")
    elif integration_provider == "gcp":
        file_path = os.path.join(configs_dir, "backend_gcp.tf")
    elif integration_provider == "azurerm":
        file_path = os.path.join(configs_dir, "backend_azurerm.tf")
    else:
        raise ValueError(f"Unsupported integration provider: {integration_provider}")

    with open(file_path) as f:
        return f.read()
