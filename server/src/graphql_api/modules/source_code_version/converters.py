from typing import Any

from strawberry.types.nodes import SelectedField

from application.source_code_versions.query_options import (
    build_source_config_query_options,
    build_source_config_template_reference_query_options,
    build_source_output_config_query_options,
)
from graphql_api.helpers import build_field_spec


def source_config_options(selected_field: SelectedField | None) -> list[Any]:
    """Build SQLAlchemy loading options from a GraphQL SelectedField."""
    return build_source_config_query_options(build_field_spec(selected_field))


def source_output_config_options(selected_field: SelectedField | None) -> list[Any]:
    """Build SQLAlchemy loading options from a GraphQL SelectedField."""
    return build_source_output_config_query_options(build_field_spec(selected_field))


def source_config_template_reference_options(selected_field: SelectedField | None) -> list[Any]:
    """Build SQLAlchemy loading options from a GraphQL SelectedField."""
    return build_source_config_template_reference_query_options(build_field_spec(selected_field))
