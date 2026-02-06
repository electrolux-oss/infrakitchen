import json
from abc import ABC, abstractmethod
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, TypeVar
from collections.abc import Callable
from pydantic import BaseModel, ConfigDict, ValidationError, Field
import httpx

from fastmcp.tools.tool import Tool, ToolResult


class GetOneParams(BaseModel):
    """Unified schema for single-entity retrieval."""

    id: str = Field(description="Unique identifier of the entity to retrieve.")

    model_config = ConfigDict(extra="forbid")


class ListParams(BaseModel):
    """Unified schema for listing entities."""

    filter: dict[str, Any] | None = Field(
        default=None,
        description=(
            """Filter criteria as key-value pairs to narrow results.
            Example: {"status": "active", "region": "us-east-1"}"""
        ),
    )
    range: tuple[int, int] = Field(
        default=(0, 5),
        description=(
            "Pagination range as [start, end] indices (0-based, inclusive). "
            "Example: [0, 24] returns the first 25 items, [25, 49] returns the next 25. "
            "Defaults to [0, 5] (first 6 items)."
        ),
    )

    model_config = ConfigDict(extra="forbid")


TParams = TypeVar("TParams", bound=BaseModel)


@dataclass(frozen=True)
class EndpointAdapter[TParams: BaseModel]:
    """Declares how an endpoint maps to a unified interface."""

    entity_name: str
    endpoint_fn: Callable[..., Any]
    param_renames: dict[str, str] = field(default_factory=dict)
    static_params: dict[str, Any] = field(default_factory=dict)

    def transform(self, unified: TParams) -> dict[str, Any]:
        """Transform unified parameters to endpoint-specific parameters."""
        result = dict(self.static_params)

        for unified_name, value in unified.model_dump(exclude_none=True).items():
            endpoint_name = self.param_renames.get(unified_name, unified_name)
            result[endpoint_name] = value

        return result

    def __post_init__(self):
        if not self.entity_name:
            raise ValueError("entity_name is required")
        if not callable(self.endpoint_fn):
            raise ValueError(f"endpoint_fn must be callable, got {type(self.endpoint_fn)}")


@dataclass(frozen=True)
class GroupDefinition[TParams: BaseModel]:
    """Defines a group of operations."""

    name: str
    tool_name: str
    description_template: str
    params_class: type[TParams]

    def validate_adapter(self, adapter: EndpointAdapter[TParams]) -> list[str]:
        return []


get_one_group = GroupDefinition(
    name="get_one",
    tool_name="get_entity",
    description_template="Get a single entity by ID.\n\nAvailable entity types: {entities}",
    params_class=GetOneParams,
)

list_entities_group = GroupDefinition(
    name="list",
    tool_name="list_entities",
    description_template="List entities with optional filtering and pagination.\n\nAvailable entity types: {entities}",
    params_class=ListParams,
)


class EndpointExecutor(ABC):
    """Abstract executor for different execution strategies."""

    @abstractmethod
    async def execute(self, endpoint: Callable[..., Any], params: dict[str, Any]) -> Any:
        pass


class HTTPExecutor(EndpointExecutor):
    """Executes endpoints via HTTP calls."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        base_url: str = "",
        auth_context: ContextVar[str | None] | None = None,
    ):
        self._client = client
        self._base_url = base_url
        self._auth_context = auth_context
        self._route_map: dict[Callable[..., Any], tuple[str, str]] = {}

    def register_route(self, fn: Callable[..., Any], method: str, path: str):
        """Register how to call a function via HTTP."""
        self._route_map[fn] = (method.upper(), path)

    def _encode_query_value(self, value: Any) -> str | None:
        """Encode a value for use as a query parameter."""
        if value is None:
            return None
        if isinstance(value, (dict, list, tuple)):
            return json.dumps(value)
        if isinstance(value, bool):
            return str(value).lower()
        return str(value)

    def _get_headers(self) -> dict[str, str]:
        """Build request headers, including auth if available."""
        headers = {}
        if self._auth_context is not None:
            auth_value = self._auth_context.get(None)
            if auth_value:
                headers["Authorization"] = auth_value
        return headers

    async def execute(self, endpoint: Callable[..., Any], params: dict[str, Any]) -> Any:
        if endpoint not in self._route_map:
            raise ValueError(f"No route registered for {endpoint.__name__}")

        method, path_template = self._route_map[endpoint]

        path = path_template
        query_params = {}

        for key, value in params.items():
            if value is None:
                continue

            placeholder = f"{{{key}}}"
            if placeholder in path_template:
                path = path.replace(placeholder, str(value))
            else:
                encoded = self._encode_query_value(value)
                if encoded is not None:
                    query_params[key] = encoded

        url = f"{self._base_url}{path}"
        headers = self._get_headers()

        response = await self._client.request(
            method=method,
            url=url,
            params=query_params if query_params else None,
            headers=headers if headers else None,
        )
        response.raise_for_status()

        return response.json()


@dataclass
class DispatchContext:
    """Runtime context for a dispatch tool."""

    group: GroupDefinition[Any]
    adapters: dict[str, EndpointAdapter[Any]]
    executor: EndpointExecutor


_DISPATCH_CONTEXTS: dict[str, DispatchContext] = {}


def _register_dispatch_context(tool_name: str, context: DispatchContext) -> None:
    _DISPATCH_CONTEXTS[tool_name] = context


def _get_dispatch_context(tool_name: str) -> DispatchContext | None:
    return _DISPATCH_CONTEXTS.get(tool_name)


class DispatchTool(Tool):
    """Tool that dispatches to underlying endpoints based on entity_type."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def __init__(
        self,
        group: GroupDefinition[TParams],
        adapters: dict[str, EndpointAdapter[TParams]],
        executor: EndpointExecutor,
    ):
        all_errors = []
        for adapter in adapters.values():
            errors = group.validate_adapter(adapter)
            all_errors.extend(errors)

        if all_errors:
            raise ValueError(f"Invalid adapters for {group.name}:\n" + "\n".join(all_errors))

        entities = sorted(adapters.keys())
        parameters = self._build_parameters(group.params_class, entities)

        super().__init__(
            name=group.tool_name,
            description=group.description_template.format(entities=", ".join(entities)),
            parameters=parameters,
        )

        _register_dispatch_context(group.tool_name, DispatchContext(group=group, adapters=adapters, executor=executor))

    @staticmethod
    def _build_parameters(params_class: type[BaseModel], entities: list[str]) -> dict[str, Any]:
        schema = params_class.model_json_schema()

        properties = {
            "entity_type": {
                "type": "string",
                "enum": entities,
                "description": f"Type of entity: {', '.join(entities)}",
            },
            **schema.get("properties", {}),
        }

        required = ["entity_type"] + schema.get("required", [])

        return {
            "type": "object",
            "properties": properties,
            "required": required,
        }

    async def run(self, arguments: dict[str, Any]) -> ToolResult:
        context = _get_dispatch_context(self.name)
        if context is None:
            raise RuntimeError(f"No dispatch context registered for tool '{self.name}'")

        args = arguments.copy()
        entity_type = args.pop("entity_type", None)

        if entity_type not in context.adapters:
            available = ", ".join(sorted(context.adapters.keys()))
            raise ValueError(f"Unknown entity_type: '{entity_type}'. Available: {available}")

        try:
            validated = context.group.params_class(**args)
        except ValidationError as e:
            raise ValueError(f"Invalid parameters: {e}") from e

        adapter = context.adapters[entity_type]
        endpoint_params = adapter.transform(validated)

        result = await context.executor.execute(adapter.endpoint_fn, endpoint_params)
        if isinstance(result, list):
            result = {"data": result}
        return self.convert_result(result)
