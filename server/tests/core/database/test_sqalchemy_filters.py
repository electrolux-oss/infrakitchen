from typing import Any
import uuid
import pytest
from sqlalchemy import (
    JSON,
    Column,
    String,
    select,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql.selectable import Select

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_sorting

Base = declarative_base()
TEST_UUID_1 = uuid.uuid4()
TEST_UUID_2 = uuid.uuid4()


class MockModel(Base):
    """A mock SQLAlchemy model for testing the filter evaluation."""

    __tablename__ = "mock_model"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    tags = Column(JSONB)
    dependency_tags = Column(JSON)
    template_id = Column(PG_UUID(as_uuid=True))


def _get_compiled_filter_str(statement: Select[Any]) -> str:
    """
    Compiles a Select statement into a single, readable SQL WHERE clause string.
    """
    compiled = statement.compile(compile_kwargs={"literal_binds": True})

    full_sql = str(compiled)
    if "WHERE" in full_sql:
        return full_sql.split("WHERE ", 1)[1].strip()

    return ""


def _compile_with_params(statement: Select[Any]) -> tuple[str, list[Any]]:
    """JSONB literals can't be rendered inline, so return the SQL and bound params in order."""
    compiled = statement.compile(dialect=postgresql.dialect())
    return str(compiled), [compiled.params[name] for name in compiled.positiontup or compiled.params]


class TestEvaluateSqlalchemyFilters:
    """Tests the generic API filter conversion utility."""

    def test_empty_filters(self):
        """Should return an empty list when the filter body is empty."""
        statement = select(MockModel)
        new_statement = evaluate_sqlalchemy_filters(MockModel, statement, {})
        assert statement == new_statement

    def test_unknown_field(self):
        """Should ignore filters for fields that do not exist on the model."""
        body = {"non_existent_field": "some_value"}
        startement = select(MockModel)
        with pytest.raises(ValueError, match="Invalid field name: non_existent_field in filter"):
            evaluate_sqlalchemy_filters(MockModel, startement, body)

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
        statement = select(MockModel)
        new_statement = evaluate_sqlalchemy_filters(MockModel, statement, body)
        sql = _get_compiled_filter_str(new_statement)
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
        statement = select(MockModel)
        new_statement = evaluate_sqlalchemy_filters(MockModel, statement, body)
        sql = _get_compiled_filter_str(new_statement)
        assert expected_sql in sql

    def test_contains_all_operator(self):
        """
        Tests the 'contains_all' operator for JSONB columns.
        """
        body = {"tags__contains_all": ["database", "production"]}
        statement = select(MockModel)
        new_statement = evaluate_sqlalchemy_filters(MockModel, statement, body)
        sql = _get_compiled_filter_str(new_statement)

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
        statement = select(MockModel)
        new_statement = evaluate_sqlalchemy_filters(MockModel, statement, body)

        sql = _get_compiled_filter_str(new_statement)
        assert "mock_model.name = 'Specific Name'" in sql
        assert "CAST(mock_model.tags AS JSONB) ? 'critical'" in sql
        assert f"mock_model.template_id = '{TEST_UUID_1.hex}'" in sql

    def test_or_filter(self):
        """Should combine filter objects in "or" with OR and each object's conditions with AND."""
        body = {
            "or": [
                {"template_id": [str(TEST_UUID_1), str(TEST_UUID_2)]},
                {"name": "postgresql", "tags__is_none": True},
            ]
        }
        statement = evaluate_sqlalchemy_filters(MockModel, select(MockModel), body)
        filter_str = _get_compiled_filter_str(statement)
        assert " OR " in filter_str
        assert "mock_model.template_id IN" in filter_str
        assert "mock_model.name = 'postgresql' AND mock_model.tags IS NULL" in filter_str

    def test_or_filter_combined_with_other_filters(self):
        """Should AND the "or" group with the other filters."""
        body = {"name__like": "pg", "or": [{"name": "a"}, {"name": "b"}]}
        statement = evaluate_sqlalchemy_filters(MockModel, select(MockModel), body)
        filter_str = _get_compiled_filter_str(statement)
        assert (
            "LIKE '%' || lower('pg') || '%' ESCAPE '/') AND (mock_model.name = 'a' OR mock_model.name = 'b')"
            in filter_str
        )

    @pytest.mark.parametrize("value", [{"name": "a"}, [{}], ["name"]])
    def test_or_filter_invalid(self, value):
        """Should reject "or" values that are not a list of non-empty filter objects."""
        with pytest.raises(ValueError, match="Filter 'or' must be a list"):
            evaluate_sqlalchemy_filters(MockModel, select(MockModel), {"or": value})

    @pytest.mark.parametrize(
        "value",
        [["env:prod"], [{"name": "env", "value": "prod"}]],
    )
    def test_contains_entries_name_and_value(self, value):
        statement = evaluate_sqlalchemy_filters(
            MockModel, select(MockModel), {"dependency_tags__contains_entries": value}
        )
        sql, params = _compile_with_params(statement)
        assert "jsonb_path_exists(CAST(mock_model.dependency_tags AS JSONB)" in sql
        assert params == [
            "$[*] ? (@.name == $name && !(@.sensitive == true) && (@.value == $v0))",
            {"name": "env", "v0": "prod"},
        ]

    def test_contains_entries_name_only(self):
        statement = evaluate_sqlalchemy_filters(
            MockModel, select(MockModel), {"dependency_tags__contains_entries": ["env"]}
        )
        sql, params = _compile_with_params(statement)
        assert "CAST(mock_model.dependency_tags AS JSONB) @>" in sql
        assert params == [[{"name": "env"}]]

    def test_contains_entries_numeric_value_matches_both_types(self):
        statement = evaluate_sqlalchemy_filters(
            MockModel, select(MockModel), {"dependency_tags__contains_entries": ["port:5432"]}
        )
        _, params = _compile_with_params(statement)
        assert "(@.value == $v0 || @.value == $v1)" in params[0]
        assert params[1] == {"name": "port", "v0": "5432", "v1": 5432}

    def test_contains_entries_never_matches_sensitive_values(self):
        statement = evaluate_sqlalchemy_filters(
            MockModel, select(MockModel), {"dependency_tags__contains_entries": ["password:hunter2"]}
        )
        _, params = _compile_with_params(statement)
        assert "!(@.sensitive == true)" in params[0]
        assert "hunter2" not in params[0]

    def test_contains_entries_multiple_entries_are_anded(self):
        statement = evaluate_sqlalchemy_filters(
            MockModel, select(MockModel), {"dependency_tags__contains_entries": ["env:prod", "team"]}
        )
        sql, params = _compile_with_params(statement)
        assert params[1] == {"name": "env", "v0": "prod"}
        assert params[2] == [{"name": "team"}]
        assert " AND " in sql

    @pytest.mark.parametrize("value", [[":prod"], [{"value": "x"}], [{"name": 1}], [123], [""]])
    def test_contains_entries_invalid(self, value):
        with pytest.raises(ValueError, match="Entry filter"):
            evaluate_sqlalchemy_filters(MockModel, select(MockModel), {"dependency_tags__contains_entries": value})


class TestEvaluateSqlalchemySorting:
    @pytest.mark.parametrize("field", ["dependency_tags", "dependencyTags", "tags"])
    def test_json_columns_are_not_sorted(self, field):
        statement = select(MockModel)
        assert evaluate_sqlalchemy_sorting(MockModel, statement, (field, "ASC")) is statement

    def test_regular_column_is_sorted(self):
        statement = evaluate_sqlalchemy_sorting(MockModel, select(MockModel), ("name", "DESC"))
        assert "ORDER BY mock_model.name DESC" in str(statement)


class TestLikeFilters:
    def test_like_matches_wildcards_literally(self):
        statement = evaluate_sqlalchemy_filters(MockModel, select(MockModel), {"name__like": "50%_off"})
        sql, params = _compile_with_params(statement)

        assert "ILIKE" in sql
        assert "ESCAPE '/'" in sql
        assert "50/%/_off" in params

    def test_like_strips_surrounding_wildcards(self):
        plain = evaluate_sqlalchemy_filters(MockModel, select(MockModel), {"name__like": "VPC"})
        wrapped = evaluate_sqlalchemy_filters(MockModel, select(MockModel), {"name__like": "%VPC%"})

        assert _compile_with_params(plain) == _compile_with_params(wrapped)

    def test_not_like_is_negated(self):
        statement = evaluate_sqlalchemy_filters(MockModel, select(MockModel), {"name__not_like": "api:"})
        sql, params = _compile_with_params(statement)

        assert "NOT ILIKE" in sql or "NOT (" in sql
        assert "api:" in params
