import logging
import os
import socket
from urllib.parse import unquote, urlsplit

from opentelemetry import metrics
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_INSTANCE_ID, SERVICE_NAME, Resource

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


def _normalize_protocol(protocol: str) -> str:
    normalized = protocol.strip().lower()
    if normalized in {"http/protobuf", "http"}:
        return "http/protobuf"
    logger.warning("Unsupported OTLP protocol '%s'. Falling back to http/protobuf.", protocol)
    return "http/protobuf"


def init_metrics(service_name: str) -> MeterProvider | None:
    """Initialize OpenTelemetry metrics provider once per process."""
    global _meter_provider

    if _meter_provider is not None:
        return _meter_provider

    settings = Settings()
    if not settings.OTEL_METRICS_ENABLED:
        logger.info("OpenTelemetry metrics are disabled")
        return None

    protocol = _normalize_protocol(settings.OTEL_EXPORTER_OTLP_PROTOCOL)
    if protocol != "http/protobuf":
        return None

    resource = Resource.create(_resource_attributes(service_name, settings.OTEL_RESOURCE_ATTRIBUTES))

    exporter = OTLPMetricExporter(endpoint=_metrics_endpoint(settings.OTEL_EXPORTER_OTLP_ENDPOINT))
    reader = PeriodicExportingMetricReader(exporter)
    provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(provider)
    _meter_provider = provider
    logger.info("OpenTelemetry metrics initialized for service '%s'", service_name)
    return _meter_provider


def get_meter(name: str):
    return metrics.get_meter(name)
