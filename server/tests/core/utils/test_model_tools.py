import pytest

from types import SimpleNamespace

from core.utils.model_tools import has_field_changes


class TestHasFieldChanges:
    def test_returns_false_when_scalar_unchanged(self):
        existing = SimpleNamespace(name="ololo", description="desc")

        assert has_field_changes({"name": "ololo"}, existing) is False

    def test_returns_true_when_scalar_changed(self):
        existing = SimpleNamespace(name="ololo", description="desc")

        assert has_field_changes({"name": "new-name"}, existing) is True

    def test_only_compares_provided_keys(self):
        existing = SimpleNamespace(name="ololo", description="desc")

        # description differs but is not part of the update body
        assert has_field_changes({"name": "ololo"}, existing) is False

    def test_rises_error_for_unknown_attribute(self):
        existing = SimpleNamespace(name="ololo")

        with pytest.raises(AttributeError):
            assert has_field_changes({"missing": "value"}, existing) is True

    def test_list_value_change_detected(self):
        existing = SimpleNamespace(labels=["a", "b"])

        assert has_field_changes({"labels": ["a", "b"]}, existing) is False
        assert has_field_changes({"labels": ["a", "c"]}, existing) is True

    def test_empty_update_body_returns_false(self):
        existing = SimpleNamespace(name="ololo")

        assert has_field_changes({}, existing) is False
