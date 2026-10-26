from unittest.mock import AsyncMock

import pytest

from application.providers.slack.slack_provider import SlackProvider


async def _send(monkeypatch, **kwargs) -> str:
    provider = object.__new__(SlackProvider)
    api_client = AsyncMock()
    monkeypatch.setattr(provider, "get_api_client", AsyncMock(return_value=api_client), raising=False)
    await provider.send_notification(channel="U123", msg="Apply finished", **kwargs)
    return api_client.post_message.await_args.kwargs["text"]


class TestSlackNotificationLink:
    @pytest.mark.asyncio
    async def test_links_to_entity(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com/")
        text = await _send(monkeypatch, entity_type="workspace", entity_id="abc", event_type="update")
        assert "<https://ik.example.com/workspaces/abc|Open in InfraKitchen>" in text

    @pytest.mark.asyncio
    async def test_resource_execute_links_to_audit_tab(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "https://ik.example.com")
        text = await _send(monkeypatch, entity_type="resource", entity_id="abc", event_type="execute")
        assert "<https://ik.example.com/resources/abc/audit|Open in InfraKitchen>" in text

    @pytest.mark.asyncio
    async def test_no_link_without_infrakitchen_url(self, monkeypatch):
        monkeypatch.setenv("INFRAKITCHEN_URL", "")
        text = await _send(monkeypatch, entity_type="resource", entity_id="abc")
        assert "Open in InfraKitchen" not in text
