from dataclasses import dataclass
from typing import Any

import httpx

from fastmcp import FastMCP

from .context import request_auth_token

GRAPHQL_PATH = "/api/graphql"
GRAPHQL_JSON_SCALAR_FIELDS = {"configuration"}


@dataclass(frozen=True)
class EntityWrites:
    """Definition of the create + patch tools for one entity type."""

    name: str
    path: str
    create_graphql_mutation: str | None = None
    create_graphql_input_type: str | None = None
    patch_graphql_mutation: str | None = None
    patch_graphql_input_type: str | None = None
    graphql_selection: str = "id entityName"
    action_query_field: str | None = None
    action_mutation: str | None = None
    create_hint: str = ""
    patch_hint: str = ""


ENTITIES: list[EntityWrites] = [
    EntityWrites(
        name="resource",
        path="/api/resources",
        create_graphql_mutation="createResource",
        create_graphql_input_type="ResourceCreateInput!",
        patch_graphql_mutation="updateResource",
        patch_graphql_input_type="ResourceUpdateInput!",
        graphql_selection="id name description entityName",
        action_query_field="resourceActions",
        action_mutation="resourceAction",
        create_hint=(
            "Resources are created in the `provision` state (equivalent to `approval_pending`). "
            "With the approval flow enabled (default) the new resource waits for a human to "
            "approve before any cloud infrastructure is provisioned — this tool will not bypass "
            "that gate. Required: `name`, `template_id`. Most resources also need "
            "`source_code_version_id`, `parents`, `variables` (see the template's source "
            "code version for the variable schema), and `integration_ids` (copy from the "
            "parent resource — query the parent's `integrationIds { id }` to find the right "
            "values). Also commonly needed: `storage_id` and `storage_path` — both are "
            "required together. Copy `storage_id` from a sibling resource using the same "
            "storage backend, and set `storage_path` following the pattern "
            "`service-catalog/{template_slug}/{resource_name}/terraform.tfstate`. "
            "Note: resource names must be unique per template, including destroyed resources. "
            "If a name is taken, use a different name (e.g. append a suffix). "
            "\n\nTo discover field values, query an existing resource of the same template "
            "via GraphQL (even destroyed ones work): "
            '`{ resources(filter: {template__name__like: "%example%"}) { '
            "id name state variables sourceCodeVersion { id } storage { id } storagePath "
            "integrationIds { id } parents { id } template { id slug } } }`. "
            "Then copy `source_code_version_id`, `variables`, `integration_ids`, and "
            "`storage_id` from that resource into the create body."
        ),
        patch_hint=(
            "If the resource is `approval_pending`/`provision` the patch is applied to the "
            "pending revision; otherwise it is staged as a temp state pending human approval. "
            "Either way, this stays on the safe side of the approval gate. Resource writes use "
            "GraphQL mutations. Prefer snake_case keys in the MCP body; they are translated to "
            "GraphQL camelCase automatically where needed."
        ),
    ),
    EntityWrites(
        name="template",
        path="/api/templates",
        create_graphql_mutation="createTemplate",
        create_graphql_input_type="TemplateCreateInput!",
        patch_graphql_mutation="updateTemplate",
        patch_graphql_input_type="TemplateUpdateInput!",
        graphql_selection="id name template entityName",
        action_query_field="templateActions",
        action_mutation="templateAction",
        create_hint=(
            "Templates are the IaC definitions developers consume. Use the GraphQL "
            "`get_schema TemplateType` to discover required fields. Templates can be abstract "
            "(grouping only) or concrete (backed by a source code version). "
            "WARNING: template changes take effect immediately — there is no approval gate."
        ),
        patch_hint=(
            "Template writes use GraphQL mutations. Prefer snake_case keys in the MCP body; "
            "they are translated to GraphQL camelCase automatically where needed."
        ),
    ),
    EntityWrites(
        name="source_code",
        path="/api/source_codes",
        create_graphql_mutation="createSourceCode",
        create_graphql_input_type="SourceCodeCreateInput!",
        patch_graphql_mutation="updateSourceCode",
        patch_graphql_input_type="SourceCodeUpdateInput!",
        graphql_selection="id sourceCodeUrl entityName",
        action_query_field="sourceCodeActions",
        action_mutation="sourceCodeAction",
        create_hint=(
            "A source code is a pointer to a git repo / IaC module location. "
            "Typical required fields: `source_code_url`, `source_code_provider`, and "
            "`source_code_language`; optional: `integration_id`, `description`, `labels`. "
            "Use an existing source code as a shape example via GraphQL: "
            "`{ sourceCodes(range: [0, 20]) { id sourceCodeUrl sourceCodeProvider sourceCodeLanguage identifier integration { id name } } }`. "  # noqa: E501
            "`source_code_versions` are then created against it to pin a specific "
            "branch/tag/folder. In GraphQL, SourceCodeType does NOT have a `name` field; use "
            "`sourceCodeUrl`, `sourceCodeProvider`, `sourceCodeLanguage`, or `identifier`. "
            "WARNING: source code changes take effect immediately — there is no approval gate."
        ),
        patch_hint=(
            "Source code writes use GraphQL mutations. Prefer snake_case keys in the MCP body; "
            "they are translated to GraphQL camelCase automatically where needed."
        ),
    ),
    EntityWrites(
        name="source_code_version",
        path="/api/source_code_versions",
        create_graphql_mutation="createSourceCodeVersion",
        create_graphql_input_type="SourceCodeVersionCreateInput!",
        patch_graphql_mutation="updateSourceCodeVersion",
        patch_graphql_input_type="SourceCodeVersionUpdateInput!",
        graphql_selection="id sourceCodeFolder sourceCodeVersion sourceCodeBranch entityName",
        action_query_field="sourceCodeVersionActions",
        action_mutation="sourceCodeVersionAction",
        create_hint=(
            "Pins a specific version (branch/tag, folder) of a `source_code` and is what a "
            "concrete template instantiates. Typical required fields: `template_id`, "
            "`source_code_id`, and one of `source_code_version` or `source_code_branch`; "
            "optional: `source_code_folder`, `description`, `labels`. Use GraphQL to inspect "
            "existing versions before creating one: "
            "`{ sourceCodeVersions(range: [0, 20]) { id sourceCodeFolder sourceCodeVersion sourceCodeBranch template { id name } sourceCode { id sourceCodeUrl } } }`. "  # noqa: E501
            "concrete template instantiates. "
            "WARNING: changes take effect immediately — there is no approval gate."
        ),
        patch_hint=(
            "Source code version writes use GraphQL mutations. Prefer snake_case keys in the MCP "
            "body; they are translated to GraphQL camelCase automatically where needed."
        ),
    ),
    EntityWrites(
        name="storage",
        path="/api/storages",
        create_graphql_mutation="createStorage",
        create_graphql_input_type="StorageCreateInput!",
        patch_graphql_mutation="updateStorage",
        patch_graphql_input_type="StorageUpdateInput!",
        graphql_selection="id name storageType storageProvider entityName",
        action_query_field="storageActions",
        action_mutation="storageAction",
        create_hint=(
            "Configures a Terraform/OpenTofu state backend that resources can store state in. "
            "Typical required fields: `name`, `storage_type`, `storage_provider`, `integration_id`, "
            "and provider-specific `configuration`. For AWS use `configuration: {storage_provider: "
            '"aws", aws_bucket_name, aws_region}`; for GCP use `gcp_bucket_name`, `gcp_region`; '
            "for AzureRM use `azurerm_resource_group_name`, `azurerm_storage_account_name`, "
            "and `azurerm_container_name`. Query existing storages to copy the exact shape: "
            "`{ storages(range: [0, 20]) { id name storageType storageProvider integration { id name } } }`. "
            "WARNING: storage changes take effect immediately — there is no approval gate."
        ),
        patch_hint=(
            "Storage writes use GraphQL mutations. Prefer snake_case keys in the MCP body; they "
            "are translated to GraphQL camelCase automatically where needed."
        ),
    ),
    EntityWrites(
        name="integration",
        path="/api/integrations",
        create_graphql_mutation="createIntegration",
        create_graphql_input_type="IntegrationCreateInput!",
        patch_graphql_mutation="updateIntegration",
        patch_graphql_input_type="IntegrationUpdateInput!",
        graphql_selection="id name integrationProvider entityName",
        action_query_field="integrationActions",
        action_mutation="integrationAction",
        create_hint=(
            "Integrations hold provider credentials and connection configuration. Typical required "
            "fields: `name`, `integration_type`, `integration_provider`, and provider-specific "
            "`configuration`; optional: `description`, `labels`. Query existing integrations to "
            "copy the exact shape for the provider you need: "
            "`{ integrations(range: [0, 20]) { id name integrationType integrationProvider } }`. "
            "Integration writes use GraphQL mutations. Prefer snake_case keys in the MCP body; "
            "they are translated to GraphQL camelCase automatically where needed."
        ),
        patch_hint=(
            "Integration writes use GraphQL mutations. Prefer snake_case keys in the MCP body; "
            "they are translated to GraphQL camelCase automatically where needed."
        ),
    ),
    EntityWrites(
        name="executor",
        path="/api/executors",
        create_graphql_mutation="createExecutor",
        create_graphql_input_type="ExecutorCreateInput!",
        patch_graphql_mutation="updateExecutor",
        patch_graphql_input_type="ExecutorUpdateInput!",
        graphql_selection="id name runtime entityName",
        action_query_field="executorActions",
        action_mutation="executorAction",
        create_hint=(
            "Executors run IaC code directly against a source repository/version. Typical required "
            "fields: `name`, `source_code_id`; commonly needed: one of `source_code_version` or "
            "`source_code_branch`, `source_code_folder`, `runtime`, `integration_ids`, and, when "
            "remote state is needed, both `storage_id` and `storage_path`. Optional: `secret_ids`, "
            "`command_args`, `description`, `labels`. Query an existing executor to copy the shape: "
            "`{ executors(range: [0, 20]) { id name runtime commandArgs sourceCode { id sourceCodeUrl } integrationIds { id } storage { id name } storagePath } }`. "  # noqa: E501
            "Executor writes use GraphQL mutations. Prefer snake_case keys in the MCP body; they "
            "are translated to GraphQL camelCase automatically where needed."
        ),
        patch_hint=(
            "Executor writes use GraphQL mutations. Prefer snake_case keys in the MCP body; they "
            "are translated to GraphQL camelCase automatically where needed."
        ),
    ),
]


def register_rest_write_tools(mcp: FastMCP, client: httpx.AsyncClient) -> None:
    """Register create + patch tools for every entity in `ENTITIES`.

    Each entity gets `create_<name>` and `patch_<name>`. Entities with lifecycle
    action mutations also get `patch_action_<name>`.
    """
    for entity in ENTITIES:
        _register_create(mcp, client, entity)
        _register_patch(mcp, client, entity)
        _register_action(mcp, client, entity)


def _register_create(mcp: FastMCP, client: httpx.AsyncClient, entity: EntityWrites) -> None:
    description = (
        f"Create a new {entity.name}. "
        f"Use the GraphQL discovery tools (`get_schema`) to find the field shape. "
        f"{entity.create_hint}{_action_reference(entity)}"
    ).strip()

    async def create(body: dict[str, Any]) -> dict[str, Any]:
        if entity.create_graphql_mutation and entity.create_graphql_input_type:
            return await _graphql_create(client, entity, body)
        return await _post(client, entity.path, body)

    mcp.tool(name=f"create_{entity.name}", description=description)(create)


def _register_patch(mcp: FastMCP, client: httpx.AsyncClient, entity: EntityWrites) -> None:
    description = (
        f"Update fields on an existing {entity.name}. At least one field must be provided. "
        f"{entity.patch_hint}{_action_reference(entity)}"
    ).strip()

    async def patch(entity_id: str, body: dict[str, Any]) -> dict[str, Any]:
        if not body:
            raise ValueError("`body` must contain at least one field to update.")
        if entity.patch_graphql_mutation and entity.patch_graphql_input_type:
            return await _graphql_patch(client, entity, entity_id, body)
        return await _patch(client, f"{entity.path}/{entity_id}", body)

    mcp.tool(name=f"patch_{entity.name}", description=description)(patch)


def _register_action(mcp: FastMCP, client: httpx.AsyncClient, entity: EntityWrites) -> None:
    if entity.action_query_field is None or entity.action_mutation is None:
        return

    description = (
        f"Run a lifecycle action on an existing {entity.name}. "
        f"Call `{entity.action_query_field}` first to see allowed actions for the current entity state, "
        f"then pass one of those values as `action`."
    )

    async def patch_action(entity_id: str, action: str) -> dict[str, Any]:
        if not action.strip():
            raise ValueError("`action` must be a non-empty string.")
        return await _graphql_action(client, entity, entity_id, action)

    mcp.tool(name=f"patch_action_{entity.name}", description=description)(patch_action)


async def _post(client: httpx.AsyncClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(path, json=body, headers=_auth_headers())
    return _handle_response(response)


async def _patch(client: httpx.AsyncClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.patch(path, json=body, headers=_auth_headers())
    return _handle_response(response)


async def _graphql_create(client: httpx.AsyncClient, entity: EntityWrites, body: dict[str, Any]) -> dict[str, Any]:
    mutation_name = entity.create_graphql_mutation
    input_type = entity.create_graphql_input_type
    assert mutation_name is not None
    assert input_type is not None

    query = f"""
    mutation Create{_pascal_case(entity.name)}($input: {input_type}) {{
      {mutation_name}(input: $input) {{
        {entity.graphql_selection}
      }}
    }}
    """
    return await _graphql_request(
        client,
        query=query,
        variables={"input": _camelize_keys(body)},
        result_key=mutation_name,
    )


async def _graphql_patch(
    client: httpx.AsyncClient,
    entity: EntityWrites,
    entity_id: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    mutation_name = entity.patch_graphql_mutation
    input_type = entity.patch_graphql_input_type
    assert mutation_name is not None
    assert input_type is not None

    query = f"""
    mutation Update{_pascal_case(entity.name)}($id: UUID!, $input: {input_type}) {{
      {mutation_name}(id: $id, input: $input) {{
        {entity.graphql_selection}
      }}
    }}
    """
    return await _graphql_request(
        client,
        query=query,
        variables={"id": entity_id, "input": _camelize_keys(body)},
        result_key=mutation_name,
    )


async def _graphql_action(
    client: httpx.AsyncClient, entity: EntityWrites, entity_id: str, action: str
) -> dict[str, Any]:
    mutation_name = entity.action_mutation
    assert mutation_name is not None

    query = f"""
    mutation PatchAction{_pascal_case(entity.name)}($id: UUID!, $action: String!) {{
      {mutation_name}(id: $id, input: {{ action: $action }}) {{
        {entity.graphql_selection}
      }}
    }}
    """
    return await _graphql_request(
        client,
        query=query,
        variables={"id": entity_id, "action": action},
        result_key=mutation_name,
    )


async def _graphql_request(
    client: httpx.AsyncClient,
    *,
    query: str,
    variables: dict[str, Any],
    result_key: str,
) -> dict[str, Any]:
    response = await client.post(
        GRAPHQL_PATH,
        json={"query": query, "variables": variables},
        headers=_auth_headers(),
    )
    response.raise_for_status()

    body = response.json()
    errors = body.get("errors") if isinstance(body, dict) else None
    if errors:
        messages = []
        for err in errors:
            if not isinstance(err, dict):
                continue
            msg = err.get("message", "Unknown error")
            path = err.get("path")
            if path:
                msg = f"{msg} (path: {'.'.join(str(p) for p in path)})"
            messages.append(msg)
        detail = "; ".join(messages) if messages else "Unknown error"
        raise ValueError(f"GraphQL mutation failed: {detail}")

    return body.get("data", {}).get(result_key)


def _auth_headers() -> dict[str, str]:
    auth = request_auth_token.get(None)
    return {"Authorization": auth} if auth else {}


def _camelize_keys(value: Any) -> Any:
    if isinstance(value, list):
        return [_camelize_keys(item) for item in value]
    if not isinstance(value, dict):
        return value

    result: dict[str, Any] = {}
    for key, item in value.items():
        key_str = str(key)
        camel_key = _snake_to_camel(key_str)
        if key_str in GRAPHQL_JSON_SCALAR_FIELDS:
            result[camel_key] = item
        else:
            result[camel_key] = _camelize_keys(item)
    return result


def _snake_to_camel(value: str) -> str:
    if "_" not in value:
        return value
    head, *tail = value.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


def _pascal_case(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in value.split("_"))


def _action_reference(entity: EntityWrites) -> str:
    if entity.action_query_field is None or entity.action_mutation is None:
        return ""
    return (
        f" Lifecycle actions are modeled separately: query `{entity.action_query_field}(id: ...)` "
        f"to see allowed actions, then use `patch_action_{entity.name}` to run one. "
        f"The underlying GraphQL mutation is `{entity.action_mutation}`."
    )


def _handle_response(response: httpx.Response) -> dict[str, Any]:
    if response.is_success:
        return response.json()

    try:
        detail = response.json()
    except ValueError:
        detail = response.text
    raise ValueError(f"Request failed with status {response.status_code}: {detail}")
