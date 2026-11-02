import logging
import os
import socket
from urllib.parse import unquote, urlsplit

from opentelemetry import _logs, metrics, trace
from fastapi.telemetry import TelemetryConfig
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_INSTANCE_ID, SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider

from core.config import Settings

logger = logging.getLogger(__name__)

_meter_provider: MeterProvider | None = None

DEFAULT_METRICS_ENDPOINT = "http://localhost:4318/v1/metrics"
METRICS_PATH = "/v1/metrics"


def _metrics_endpoint(endpoint: str) -> str:
    """Accept both a base OTLP endpoint (per OTel spec) and a full metrics URL."""
    endpoint = endpoint.strip()
    if not endpoint:
        return DEFAULT_METRICS_ENDPOINT
    if urlsplit(endpoint).path in ("", "/"):
        return endpoint.rstrip("/") + METRICS_PATH
    return endpoint


def _parse_resource_attributes(raw: str) -> dict[str, str]:
    attributes: dict[str, str] = {}
    for pair in raw.split(","):
        if not pair.strip():
            continue
        key, sep, value = pair.partition("=")
        if not sep or not key.strip():
            logger.warning("Ignoring malformed OTEL_RESOURCE_ATTRIBUTES entry '%s'", pair)
            continue
        attributes[key.strip()] = unquote(value.strip())
    return attributes


def _resource_attributes(service_name: str, raw_attributes: str) -> dict[str, str]:
    # Unique per process so replicas don't merge their cumulative series.
    attributes = {SERVICE_INSTANCE_ID: f"{socket.gethostname()}-{os.getpid()}"}
    attributes.update(_parse_resource_attributes(raw_attributes))
    attributes[SERVICE_NAME] = service_name
    return attributes


def _validate_protocol(protocol: str) -> None:
    if protocol.strip().lower() in {"http/protobuf", "http"}:
        return
    raise ValueError(
        f"Unsupported OTEL_EXPORTER_OTLP_PROTOCOL '{protocol}': only 'http/protobuf' is supported. "
        "Point OTEL_EXPORTER_OTLP_ENDPOINT at the OTLP/HTTP port (usually 4318), not gRPC (4317)."
    )


def _build_resource(service_name: str, settings: Settings) -> Resource:
    return Resource.create(_resource_attributes(service_name, settings.OTEL_RESOURCE_ATTRIBUTES))


def init_metrics(service_name: str, with_exporter: bool = True) -> MeterProvider | None:
    """Initialize OpenTelemetry metrics provider once per process.

    Pass `with_exporter=False` when another component (FastAPI auto-configuration)
    attaches the OTLP exporter to this provider.
    """
    global _meter_provider

    if _meter_provider is not None:
        return _meter_provider

    settings = Settings()
    if not settings.OTEL_METRICS_ENABLED:
        logger.info("OpenTelemetry metrics are disabled")
        return None

    _validate_protocol(settings.OTEL_EXPORTER_OTLP_PROTOCOL)

    resource = _build_resource(service_name, settings)

    readers = []
    if with_exporter:
        exporter = OTLPMetricExporter(endpoint=_metrics_endpoint(settings.OTEL_EXPORTER_OTLP_ENDPOINT))
        readers.append(PeriodicExportingMetricReader(exporter))
    provider = MeterProvider(resource=resource, metric_readers=readers)
    metrics.set_meter_provider(provider)
    _meter_provider = provider
    logger.info("OpenTelemetry metrics initialized for service '%s'", service_name)
    return _meter_provider


def get_meter(name: str):
    return metrics.get_meter(name)


def init_api_telemetry(service_name: str) -> TelemetryConfig:
    """Set up the API's providers and return the `telemetry` config for `FastAPI()`.

    With FASTAPI_OTEL_AUTO_CONFIGURE, FastAPI attaches the OTLP exporters for metrics,
    traces and logs (endpoints read from os.environ) to these providers at startup,
    so every signal carries our resource. Otherwise only metrics are exported, by us.
    """
    settings = Settings()
    auto_configure = settings.FASTAPI_OTEL_AUTO_CONFIGURE
    _ = init_metrics(service_name, with_exporter=not auto_configure)
    telemetry_config: TelemetryConfig = {
        "auto_configure": auto_configure,
        "metrics": settings.OTEL_METRICS_ENABLED,
    }
    if not auto_configure:
        return telemetry_config

    _validate_protocol(settings.OTEL_EXPORTER_OTLP_PROTOCOL)
    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT.strip()
    if urlsplit(endpoint).path not in ("", "/"):
        logger.warning(
            "OTEL_EXPORTER_OTLP_ENDPOINT '%s' has a path; FastAPI appends /v1/<signal> to it. "
            "Use the base URL (e.g. http://localhost:4318).",
            endpoint,
        )
    _ = os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint)

    resource = _build_resource(service_name, settings)
    trace.set_tracer_provider(TracerProvider(resource=resource))
    _logs.set_logger_provider(LoggerProvider(resource=resource))
    logger.info("FastAPI OpenTelemetry auto-configuration enabled for service '%s'", service_name)
    return telemetry_config
