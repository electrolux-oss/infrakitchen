"""Tests for the drift settings entity loader (audit log resolution)."""

from unittest.mock import MagicMock
from uuid import uuid4

from application.resource_drifts.model import DRIFT_SETTINGS_ID
from graphql_api.dataloaders.entity_loaders import _load_drift_settings, entity_loaders


class TestDriftSettingsLoader:
    async def test_names_the_settings_row(self):
        # audit log rows of a settings change are named instead of shown as a deleted entity
        resolved = await _load_drift_settings([str(DRIFT_SETTINGS_ID), str(uuid4())])

        assert resolved == [
            {"id": str(DRIFT_SETTINGS_ID), "name": "Drift detection settings", "entityName": "drift_settings"},
            None,
        ]

    def test_loader_is_registered_under_the_audit_log_model_name(self):
        # DriftSettingsService writes its audit logs with entity_name="drift_settings"
        assert "drift_settings" in entity_loaders(MagicMock())
