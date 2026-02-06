from dataclasses import dataclass, field
from typing import Any, TypeVar
from collections.abc import Callable

from .dispatch_framework import EndpointAdapter, GroupDefinition

F = TypeVar("F", bound=Callable[..., Any])


@dataclass
class EndpointRegistry:
    """Central registry for endpoint adapters."""

    _adapters: dict[str, dict[str, EndpointAdapter[Any]]] = field(default_factory=dict)

    def register(
        self,
        group: GroupDefinition[Any],
        entity_name: str,
        endpoint_fn: Callable[..., Any],
        *,
        param_renames: dict[str, str] | None = None,
        static_params: dict[str, Any] | None = None,
    ) -> EndpointAdapter[Any]:
        """Register an endpoint with explicit parameter mapping."""
        adapter = EndpointAdapter(
            entity_name=entity_name,
            endpoint_fn=endpoint_fn,
            param_renames=param_renames or {},
            static_params=static_params or {},
        )

        errors = group.validate_adapter(adapter)
        if errors:
            raise ValueError(f"Invalid adapter for {entity_name}: {errors}")

        if group.name not in self._adapters:
            self._adapters[group.name] = {}

        self._adapters[group.name][entity_name] = adapter
        return adapter

    def get_adapters(self, group: GroupDefinition[Any]) -> dict[str, EndpointAdapter[Any]]:
        return self._adapters.get(group.name, {})


registry = EndpointRegistry()


def mcp_group(
    group: GroupDefinition[Any],
    entity: str,
    *,
    param_renames: dict[str, str] | None = None,
) -> Callable[[F], F]:
    """
    Decorator to register an endpoint for MCP tool grouping.

    Args:
        group: The group this endpoint belongs to
        entity: The entity name (e.g., "resources", "logs")
        param_renames: Map unified param names to endpoint param names

    Example:
        @router.get("/resources/{resource_id}")
        @mcp_group(get_one_group, "resources", param_renames={"id": "resource_id"})
        async def get_resource_by_id(resource_id: str, ...):
            ...
    """

    def decorator(fn: F) -> F:
        registry.register(
            group=group,
            entity_name=entity,
            endpoint_fn=fn,
            param_renames=param_renames,
        )
        return fn

    return decorator
