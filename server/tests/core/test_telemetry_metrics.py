import pytest
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from starlette.requests import Request
from starlette.responses import Response
from unittest.mock import Mock

import app as app_module
from core import telemetry
from core.telemetry import (
    _metrics_endpoint,
    _parse_resource_attributes,
    _resource_attributes,
    init_api_telemetry,
    init_metrics,
)


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
async def test_add_process_time_header_uses_constant_route_when_unmatched(monkeypatch):
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
            "http.route": "unmatched",
            "http.response.status_code": 200,
        },
    )
    mock_histogram.record.assert_called_once()


@pytest.fixture
def fresh_telemetry(monkeypatch):
    monkeypatch.setattr(telemetry, "_meter_provider", None)
    # In-memory reader avoids a background export thread hitting a real endpoint.
    reader_factory = Mock(side_effect=lambda _exporter: InMemoryMetricReader())
    monkeypatch.setattr(telemetry, "PeriodicExportingMetricReader", reader_factory)
    monkeypatch.setattr(telemetry.metrics, "set_meter_provider", Mock())
    return reader_factory


def test_init_metrics_disabled_by_default(monkeypatch, fresh_telemetry):
    settings_cls = telemetry.Settings
    # model_construct skips env/.env so only the class default is checked.
    monkeypatch.setattr(telemetry, "Settings", lambda: settings_cls.model_construct())
    assert init_metrics("infrakitchen-test") is None


def test_init_metrics_is_idempotent(monkeypatch, fresh_telemetry):
    monkeypatch.setenv("OTEL_METRICS_ENABLED", "true")
    first = init_metrics("infrakitchen-test")
    second = init_metrics("infrakitchen-test")
    assert first is not None
    assert first is second
    first.shutdown()


@pytest.mark.parametrize("protocol", ["grpc", "http/json"])
def test_init_metrics_rejects_unsupported_protocol(monkeypatch, fresh_telemetry, protocol):
    monkeypatch.setenv("OTEL_METRICS_ENABLED", "true")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_PROTOCOL", protocol)
    with pytest.raises(ValueError, match="only 'http/protobuf' is supported"):
        init_metrics("infrakitchen-test")


@pytest.fixture
def fastapi_providers(monkeypatch, fresh_telemetry):
    set_tracer = Mock()
    set_logger = Mock()
    monkeypatch.setattr(telemetry.trace, "set_tracer_provider", set_tracer)
    monkeypatch.setattr(telemetry._logs, "set_logger_provider", set_logger)
    # setenv first so monkeypatch restores the var set via os.environ.setdefault.
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    monkeypatch.setenv("OTEL_METRICS_ENABLED", "true")
    return set_tracer, set_logger, fresh_telemetry


def test_init_api_telemetry_without_auto_configure(monkeypatch, fastapi_providers):
    monkeypatch.setenv("FASTAPI_OTEL_AUTO_CONFIGURE", "false")

    assert init_api_telemetry("infrakitchen-api") == {"auto_configure": False, "metrics": True}

    assert telemetry._meter_provider is not None
    fastapi_providers[2].assert_called_once()
    fastapi_providers[0].assert_not_called()
    fastapi_providers[1].assert_not_called()


def test_init_api_telemetry_with_auto_configure(monkeypatch, fastapi_providers):
    monkeypatch.setenv("FASTAPI_OTEL_AUTO_CONFIGURE", "true")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4318")

    assert init_api_telemetry("infrakitchen-api") == {"auto_configure": True, "metrics": True}

    # FastAPI attaches the metrics exporter at startup, so ours must not exist.
    assert telemetry._meter_provider is not None
    fastapi_providers[2].assert_not_called()
    tracer_provider = fastapi_providers[0].call_args.args[0]
    logger_provider = fastapi_providers[1].call_args.args[0]
    assert tracer_provider.resource.attributes["service.name"] == "infrakitchen-api"
    assert logger_provider.resource.attributes["service.name"] == "infrakitchen-api"
    assert tracer_provider.resource.attributes["service.instance.id"]


def test_init_api_telemetry_keeps_fastapi_metrics_off_when_disabled(monkeypatch, fastapi_providers):
    monkeypatch.setenv("FASTAPI_OTEL_AUTO_CONFIGURE", "true")
    monkeypatch.setenv("OTEL_METRICS_ENABLED", "false")

    assert init_api_telemetry("infrakitchen-api") == {"auto_configure": True, "metrics": False}
    assert telemetry._meter_provider is None


@pytest.mark.parametrize(
    ("configured", "expected"),
    [
        ("", "http://localhost:4318/v1/metrics"),
        ("http://datadog-agent:4318", "http://datadog-agent:4318/v1/metrics"),
        ("http://otel-collector:4318/", "http://otel-collector:4318/v1/metrics"),
        ("http://otel-collector:4318/v1/metrics", "http://otel-collector:4318/v1/metrics"),
        ("https://gateway.example.com/otlp/v1/metrics", "https://gateway.example.com/otlp/v1/metrics"),
    ],
)
def test_metrics_endpoint(configured, expected):
    assert _metrics_endpoint(configured) == expected


def test_parse_resource_attributes():
    raw = "deployment.environment=prod, service.version=1.2.3,team=platform%20eng,malformed,=x"
    assert _parse_resource_attributes(raw) == {
        "deployment.environment": "prod",
        "service.version": "1.2.3",
        "team": "platform eng",
    }


def test_resource_attributes_sets_instance_id_and_keeps_service_name():
    attributes = _resource_attributes("infrakitchen-api", "service.name=other,deployment.environment=dev")
    assert attributes["service.name"] == "infrakitchen-api"
    assert attributes["deployment.environment"] == "dev"
    assert attributes["service.instance.id"]


def test_resource_attributes_allows_instance_id_override():
    attributes = _resource_attributes("infrakitchen-worker", "service.instance.id=pod-abc")
    assert attributes["service.instance.id"] == "pod-abc"
