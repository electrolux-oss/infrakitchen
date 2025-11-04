from typing import Any
import uuid
import pytest
from sqlalchemy import (
    Column,
    String,
    and_,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import declarative_base

from core.database import evaluate_sqlalchemy_filters

Base = declarative_base()
TEST_UUID_1 = uuid.uuid4()
TEST_UUID_2 = uuid.uuid4()


class MockModel(Base):
    """A mock SQLAlchemy model for testing the filter evaluation."""

    __tablename__ = "mock_model"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    tags = Column(JSONB)
    template_id = Column(PG_UUID(as_uuid=True))


def _get_compiled_filter_str(filters: list[Any]) -> str:
    """
    Compiles a list of SQLAlchemy filter expressions into a single,
    readable SQL WHERE clause string.
    """
    if not filters:
        return ""

    stmt = select(MockModel).where(and_(*filters))
    compiled = stmt.compile(compile_kwargs={"literal_binds": True})

    full_sql = str(compiled)
    if "WHERE" in full_sql:
        return full_sql.split("WHERE ", 1)[1]

    return ""


class TestEvaluateSqlalchemyFilters:
    """Tests the generic API filter conversion utility."""

    def test_empty_filters(self):
        """Should return an empty list when the filter body is empty."""
        filters = evaluate_sqlalchemy_filters(MockModel, {})
        assert filters == []

    def test_unknown_field(self):
        """Should ignore filters for fields that do not exist on the model."""
        body = {"non_existent_field": "some_value"}
        with pytest.raises(ValueError, match="Invalid field name: non_existent_field in filter"):
            evaluate_sqlalchemy_filters(MockModel, body)

    @pytest.mark.parametrize(
        "body, expected_sql",
        [
            ({"name": "My Resource"}, "mock_model.name = 'My Resource'"),
            ({"template_id": str(TEST_UUID_1)}, f"mock_model.template_id = '{TEST_UUID_1.hex}'"),
            ({"template_id": {"id": str(TEST_UUID_1)}}, f"mock_model.template_id = '{TEST_UUID_1.hex}'"),
            ({"name": {"id": "some-name"}}, "mock_model.name = 'some-name'"),
        ],
    )
    def test_eq_operator(self, body, expected_sql):
        """Tests various 'eq' (equality) conditions."""
        filters = evaluate_sqlalchemy_filters(MockModel, body)
        sql = _get_compiled_filter_str(filters)
        assert expected_sql in sql

    @pytest.mark.parametrize(
        "body, expected_sql",
        [
            (
                {"name": ["A", "B"]},
                "mock_model.name IN ('A', 'B')",
            ),
            (
                {"template_id": [str(TEST_UUID_1), str(TEST_UUID_2)]},
                f"mock_model.template_id IN ('{TEST_UUID_1.hex}', '{TEST_UUID_2.hex}')",
            ),
            (
                {"template_id": [{"id": str(TEST_UUID_1)}, {"id": str(TEST_UUID_2)}]},
                f"mock_model.template_id IN ('{TEST_UUID_1.hex}', '{TEST_UUID_2.hex}')",
            ),
            (
                {"name": [{"id": "name-a"}, {"id": "name-b"}]},
                "mock_model.name IN ('name-a', 'name-b')",
            ),
        ],
    )
    def test_in_operator_via_eq_on_list(self, body, expected_sql):
        """Tests 'IN' conditions, which are triggered by 'eq' on a list value."""
        filters = evaluate_sqlalchemy_filters(MockModel, body)
        sql = _get_compiled_filter_str(filters)
        assert expected_sql in sql

    def test_contains_all_operator(self):
        """
        Tests the 'contains_all' operator for JSONB columns.
        """
        body = {"tags__contains_all": ["database", "production"]}
        filters = evaluate_sqlalchemy_filters(MockModel, body)
        sql = _get_compiled_filter_str(filters)

        assert "CAST(mock_model.tags AS JSONB) ? 'database'" in sql
        assert "CAST(mock_model.tags AS JSONB) ? 'production'" in sql
        assert " AND " in sql

    def test_multiple_filters_are_combined(self):
        """
        Ensures that multiple different filters are all added to the list.
        """
        body = {
            "name": "Specific Name",
            "tags__contains_all": ["critical"],
            "template_id": str(TEST_UUID_1),
        }
        filters = evaluate_sqlalchemy_filters(MockModel, body)
        assert len(filters) == 3

        sql = _get_compiled_filter_str(filters)
        assert "mock_model.name = 'Specific Name'" in sql
        assert "CAST(mock_model.tags AS JSONB) ? 'critical'" in sql
        assert f"mock_model.template_id = '{TEST_UUID_1.hex}'" in sql
