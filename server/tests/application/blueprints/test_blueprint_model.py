from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers

from application.blueprints.model import Blueprint


def _compiled_secondaryjoin(relationship_attr) -> str:
    configure_mappers()
    return str(relationship_attr.property.secondaryjoin.compile(dialect=postgresql.dialect()))


def test_templates_relationship_filters_internal_templates():
    assert "blueprint_templates.is_external IS false" in _compiled_secondaryjoin(Blueprint.templates)


def test_external_templates_relationship_filters_external_templates():
    assert "blueprint_templates.is_external IS true" in _compiled_secondaryjoin(Blueprint.external_templates)
