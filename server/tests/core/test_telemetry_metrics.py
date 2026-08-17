import pytest
from starlette.requests import Request
from starlette.responses import Response
from unittest.mock import Mock

import app as app_module
from core.telemetry import init_metrics


@pytest.mark.asyncio
async def test_add_process_time_header_records_metrics(monkeypatch):
    mock_counter = Mock()
    mock_histogram = Mock()

    monkeypatch.setattr(app_module, "http_request_counter", mock_counter)
    monkeypatch.setattr(app_module, "http_request_duration", mock_histogram)

    route = Mock()
    route.path = "/zstatus"
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/zstatus",
        "raw_path": b"/zstatus",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 9999),
        "server": ("testserver", 80),
        "route": route,
    }
    request = Request(scope)

    async def call_next(_request: Request):
        return Response(content="ok", status_code=200)

    response = await app_module.add_process_time_header(request, call_next)

    assert "X-Process-Time" in response.headers
    assert response.headers["Access-Control-Expose-Headers"] == "Content-Range"

    mock_counter.add.assert_called_once_with(
        1,
        {
            "http.request.method": "GET",
            "http.route": "/zstatus",
            "http.response.status_code": 200,
        },
    )
    mock_histogram.record.assert_called_once()


@pytest.mark.asyncio
async def test_add_process_time_header_falls_back_to_request_path_when_route_is_empty(monkeypatch):
    mock_counter = Mock()
    mock_histogram = Mock()

    monkeypatch.setattr(app_module, "http_request_counter", mock_counter)
    monkeypatch.setattr(app_module, "http_request_duration", mock_histogram)

    route = Mock()
    route.path = ""
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/graphql",
        "raw_path": b"/api/graphql",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 9999),
        "server": ("testserver", 80),
        "route": route,
    }
    request = Request(scope)

    async def call_next(_request: Request):
        return Response(content="ok", status_code=200)

    await app_module.add_process_time_header(request, call_next)

    mock_counter.add.assert_called_once_with(
        1,
        {
            "http.request.method": "POST",
            "http.route": "/api/graphql",
            "http.response.status_code": 200,
        },
    )
    mock_histogram.record.assert_called_once()


def test_init_metrics_is_idempotent():
    first = init_metrics("infrakitchen-test")
    second = init_metrics("infrakitchen-test")
    assert first is second
