import logging
import re
from typing import Any

import hcl2

from application.source_code_versions.schema import (
    ProvisionedResourceResponse,
    SourceCodeVersionResponse,
    SourceOutputConfigResponse,
    SourceOutputConfigTemplateResponse,
)

logger = logging.getLogger(__name__)
_FILE_DIVIDER_PATTERN = re.compile(r"^#\s*-{2,}\s*FILE:\s*(.+?)\s*-{2,}\s*$")


def _normalize_value(value: Any) -> str:
    if isinstance(value, str):
        return value.strip().strip('"').strip("'")
    return str(value).strip().strip('"').strip("'")


def _normalize_dependency_ref(value: str) -> str:
    normalized = _normalize_value(value)
    if normalized.startswith("${") and normalized.endswith("}"):
        normalized = normalized[2:-1].strip()
    return normalized


def _extract_references(obj: Any) -> set[str]:
    refs = set()
    pattern = r'\$\{([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\}|([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)'

    if isinstance(obj, str):
        for match in re.finditer(pattern, obj):
            ref = match.group(1) or match.group(2)
            if ref:
                refs.add(ref)
    elif isinstance(obj, (list, dict)):
        for item in (obj if isinstance(obj, list) else obj.values()):
            refs.update(_extract_references(item))

    return refs


def _parse_snapshot_files(snapshot: str) -> dict[str, str]:
    files, current_name, current_lines = {}, None, []

    for line in snapshot.split("\n"):
        match = _FILE_DIVIDER_PATTERN.match(line)
        if match:
            if current_name:
                files[current_name] = "\n".join(current_lines).strip()
            current_name = match.group(1).strip()
            current_lines = []
        elif current_name:
            current_lines.append(line)

    if current_name:
        files[current_name] = "\n".join(current_lines).strip()

    return files


def fetch_provisioned_resources_from_snapshot(
    version: SourceCodeVersionResponse,
) -> list[ProvisionedResourceResponse]:
    snapshot = version.code_snapshot or ""
    if not snapshot:
        return []

    files = _parse_snapshot_files(snapshot)
    result: list[ProvisionedResourceResponse] = []
    data_sources: dict[str, ProvisionedResourceResponse] = {}
    resource_map: dict[str, ProvisionedResourceResponse] = {}

    for filename, content in files.items():
        try:
            data = hcl2.loads(content)
        except Exception as e:
            logger.warning(f"hcl2 parse error in {filename}: {e}")
            continue

        for block in data.get("resource", []):
            for rtype, instances in block.items():
                for rname, attrs in instances.items():
                    prov = ProvisionedResourceResponse(
                        type=_normalize_value(rtype),
                        name=_normalize_value(rname),
                        provider=_normalize_value(rtype).split("_")[0],
                        module_source=None,
                    )
                    prov.depends_on = []

                    if isinstance(attrs, dict) and "depends_on" in attrs:
                        deps = attrs["depends_on"]
                        prov.depends_on = [
                            _normalize_dependency_ref(str(d)) for d in (deps if isinstance(deps, list) else [deps])
                        ]

                    prov._raw_attrs = {k: v for k, v in attrs.items() if k != "depends_on"} if isinstance(attrs, dict) else {}
                    result.append(prov)
                    resource_map[f"{prov.type}.{prov.name}"] = prov

        for block in data.get("module", []):
            for mname, mconfig in block.items():
                if not isinstance(mconfig, dict) or not mconfig.get("source"):
                    continue

                prov = ProvisionedResourceResponse(
                    type="module",
                    name=_normalize_value(mname),
                    provider="",
                    module_source=_normalize_value(mconfig.get("source", "")),
                )
                prov.depends_on = []

                if "depends_on" in mconfig:
                    deps = mconfig["depends_on"]
                    prov.depends_on = [
                        _normalize_dependency_ref(str(d)) for d in (deps if isinstance(deps, list) else [deps])
                    ]

                prov._raw_attrs = {k: v for k, v in mconfig.items() if k != "depends_on"}
                result.append(prov)
                resource_map[f"module.{prov.name}"] = prov

    for resource in result + list(data_sources.values()):
        explicit = set(resource.depends_on or [])
        refs = _extract_references(getattr(resource, "_raw_attrs", {}))

        self_id = f"module.{resource.name}" if resource.type == "module" else f"{resource.type}.{resource.name}"

        for ref in refs:
            if ref != self_id and ref in resource_map:
                explicit.add(ref)

        resource.depends_on = sorted(list(explicit))
        if hasattr(resource, "_raw_attrs"):
            delattr(resource, "_raw_attrs")

    logger.info(f"fetch_provisioned_resources_from_snapshot: {len(result)} resources for version {version.id}")
    return result


def verify_config_type(config: dict[str, Any], expected_type: str) -> None:
    """
    Verify that the config dictionary has the expected type.

    Args:
        config (dict[str, Any]): The configuration dictionary to verify.
        expected_type (str): The expected type of the configuration.
    """
    if not config.get("default"):
        return

    match expected_type:
        case "number":
            config["default"] = int(config["default"])
        case "boolean":
            config["default"] = bool(config["default"])
        case "string":
            config["default"] = str(config["default"])
        case _:
            pass


def filter_template_outputs(outputs: list[SourceOutputConfigResponse]) -> list[SourceOutputConfigTemplateResponse]:
    """
    Filter the output configurations to include only one per unique name.

    Args:
        outputs (list[SourceOutputConfigResponse]): The list of output configurations.
    Returns:
        list[SourceOutputConfigTemplateResponse]: The filtered list of template output configurations.
    """
    # TODO: Check for missed outputs in the template and mark them as "deleted"
    template_outputs_dict: dict[str, tuple[SourceOutputConfigTemplateResponse, int]] = {}
    for output in outputs:
        if template_outputs_dict.get(output.name) is None:
            template_output = SourceOutputConfigTemplateResponse(
                name=output.name,
                description=output.description,
                created_at=output.created_at,
                updated_at=output.updated_at,
                status="new",
            )
            template_outputs_dict[output.name] = (template_output, 0)
        else:
            template_outputs_dict[output.name] = (
                template_outputs_dict[output.name][0],
                template_outputs_dict[output.name][1] + 1,
            )

    for output, count in template_outputs_dict.values():
        if count >= 1:
            output.status = "active"

    return [t[0] for t in template_outputs_dict.values()]
