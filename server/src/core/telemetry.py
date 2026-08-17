import logging

from opentelemetry import metrics
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource

from core.config import Settings

logger = logging.getLogger(__name__)

_meter_provider: MeterProvider | None = None


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

    resource = Resource.create(
        {
            SERVICE_NAME: service_name,
        }
    )

    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT.strip() or None
    exporter = OTLPMetricExporter(endpoint=endpoint)
    reader = PeriodicExportingMetricReader(exporter)
    provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(provider)
    _meter_provider = provider
    logger.info("OpenTelemetry metrics initialized for service '%s'", service_name)
    return _meter_provider


def get_meter(name: str):
    return metrics.get_meter(name)
