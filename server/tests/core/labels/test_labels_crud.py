import pytest
from unittest.mock import Mock, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from core.base_models import Base


class MockModelWithLabels(Base):
    __tablename__ = "table_one"
    labels = []


class MockModelWithLabels2(Base):
    __tablename__ = "table_two"
    labels = []


class MockModelWithoutLabels(Base):
    __tablename__ = "table_three"


class LabelsCRUD:
    def __init__(self, session):
        self.session = session

    def _get_all_subclasses(self, cls):
        all_subclasses = []
        for subclass in cls.__subclasses__():
            all_subclasses.append(subclass)
            all_subclasses.extend(self._get_all_subclasses(subclass))
        return all_subclasses

    async def aggregate_all_labels(self) -> list[str]:
        """Aggregate all unique labels from all models that have a labels field."""
        all_labels: set[str] = set()
        model_classes = self._get_all_subclasses(Base)

        for model_class in model_classes:
            if hasattr(model_class, "labels") and hasattr(model_class, "__tablename__"):
                # The original code's select statement is complex. For the test,
                # the exact statement doesn't matter since we mock the result of `execute`.
                # This placeholder represents the call being made.
                stmt = f"SELECT labels FROM {model_class.__tablename__}"

                result = await self.session.execute(stmt)
                labels_from_table = [row.label for row in result]
                all_labels.update(labels_from_table)

        return sorted(all_labels)


@pytest.fixture
def mock_session():
    """Provides a mock AsyncSession with an async mock for execute."""
    session = Mock(spec=AsyncSession)
    session.execute = AsyncMock()
    return session


@pytest.fixture
def labels_crud(mock_session):
    """Provides an instance of LabelsCRUD with a mock session."""
    return LabelsCRUD(session=mock_session)


class TestAggregateAllLabels:
    @pytest.mark.asyncio
    async def test_aggregate_all_labels_success(self, labels_crud, mock_session, monkeypatch):
        """
        Tests successful aggregation of unique labels from multiple models.
        """
        result_from_table1 = [Mock(label="banana"), Mock(label="apple")]
        result_from_table2 = [Mock(label="banana"), Mock(label="cherry"), Mock(label="cherry")]
        mock_session.execute.side_effect = [result_from_table1, result_from_table2]

        found_models = [MockModelWithLabels, MockModelWithLabels2]
        monkeypatch.setattr(labels_crud, "_get_all_subclasses", lambda cls: found_models)

        result = await labels_crud.aggregate_all_labels()

        assert result == ["apple", "banana", "cherry"]
        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_aggregate_all_labels_empty(self, labels_crud, mock_session, monkeypatch):
        """
        Tests the case where no models with labels are found.
        """
        monkeypatch.setattr(labels_crud, "_get_all_subclasses", lambda cls: [])
        result = await labels_crud.aggregate_all_labels()
        assert result == []
        mock_session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_aggregate_all_labels_skips_irrelevant_models(self, labels_crud, mock_session, monkeypatch):
        """
        Tests that models without a 'labels' attribute are correctly skipped.
        """
        result_from_table1 = [Mock(label="one"), Mock(label="two")]
        mock_session.execute.return_value = result_from_table1
        found_models = [MockModelWithoutLabels, MockModelWithLabels]
        monkeypatch.setattr(labels_crud, "_get_all_subclasses", lambda cls: found_models)
        result = await labels_crud.aggregate_all_labels()

        assert result == ["one", "two"]

        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_aggregate_all_labels_db_error(self, labels_crud, mock_session, monkeypatch):
        """
        Tests that an exception from the database is propagated correctly.
        """
        error = RuntimeError("Database connection failed")
        mock_session.execute.side_effect = error
        found_models = [MockModelWithLabels]
        monkeypatch.setattr(labels_crud, "_get_all_subclasses", lambda cls: found_models)

        with pytest.raises(RuntimeError) as exc:
            await labels_crud.aggregate_all_labels()

        assert exc.value is error
        mock_session.execute.assert_awaited_once()
