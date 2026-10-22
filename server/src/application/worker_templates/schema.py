import re
from datetime import datetime, UTC
from typing import Annotated, Any, Literal
import uuid

import yaml
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from core.constants.model import ModelStatus
from core.users.schema import UserShort

WorkerProviderType = Literal["kubernetes", "docker"]

DEFAULT_WORKER_COMMAND = ["/app/.venv/bin/python", "worker.py"]
MEMORY_UNITS = {"": 1, "b": 1, "k": 1024, "m": 1024**2, "g": 1024**3}


class KubernetesWorkerConfig(BaseModel):
    provider: Literal["kubernetes"] = Field(default="kubernetes", frozen=True)
    pod_manifest: str = Field(..., description="Pod manifest (YAML) used to spawn a worker")
    namespace: str | None = Field(default=None, description="Defaults to the namespace InfraKitchen runs in")

    @field_validator("pod_manifest")
    @classmethod
    def validate_pod_manifest(cls, value: str) -> str:
        parse_pod_manifest(value)
        return value


def parse_pod_manifest(manifest: str) -> dict[str, Any]:
    try:
        pod = yaml.safe_load(manifest)
    except yaml.YAMLError as e:
        raise ValueError(f"Pod manifest is not valid YAML: {e}") from e

    if not isinstance(pod, dict):
        raise ValueError("Pod manifest must be a YAML mapping")
    if pod.get("kind") != "Pod":
        raise ValueError("Pod manifest must have 'kind: Pod'")
    spec = pod.get("spec")
    if not isinstance(spec, dict) or not isinstance(spec.get("containers"), list) or not spec["containers"]:
        raise ValueError("Pod manifest must define at least one container in 'spec.containers'")
    return pod


def parse_memory(value: str) -> int:
    """Docker style memory size (``512m``, ``2g``, ``1048576``) in bytes."""
    match = re.fullmatch(r"\s*(\d+)\s*([bkmg]?)b?\s*", value.lower())
    if not match:
        raise ValueError(f"Invalid memory size '{value}', use e.g. 512m or 2g")
    return int(match.group(1)) * MEMORY_UNITS[match.group(2)]


class DockerWorkerConfig(BaseModel):
    provider: Literal["docker"] = Field(default="docker", frozen=True)
    docker_host: str = Field(
        default="unix:///var/run/docker.sock", description="Docker daemon: unix://, tcp://, http:// or https://"
    )
    image: str | None = Field(default=None, description="Defaults to the image of the InfraKitchen container")
    command: list[str] = Field(default_factory=lambda: list(DEFAULT_WORKER_COMMAND))
    network: str | None = Field(default=None, description="Defaults to the network of the InfraKitchen container")
    env: dict[str, str] = Field(default_factory=dict, description="Added to the inherited InfraKitchen environment")
    volumes: list[str] = Field(default_factory=list, description="Bind mounts, e.g. /data:/data:ro")
    memory: str | None = Field(default=None, description="Memory limit, e.g. 2g")
    cpus: float | None = Field(default=None, gt=0, description="CPU limit, e.g. 1.5")
    extra_hosts: list[str] = Field(default_factory=list, description="host:ip entries added to /etc/hosts")

    @field_validator("docker_host")
    @classmethod
    def validate_docker_host(cls, value: str) -> str:
        if not value.startswith(("unix://", "tcp://", "http://", "https://")):
            raise ValueError("Docker host must start with unix://, tcp://, http:// or https://")
        return value

    @field_validator("command")
    @classmethod
    def validate_command(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("Command must not be empty")
        return value

    @field_validator("memory")
    @classmethod
    def validate_memory(cls, value: str | None) -> str | None:
        if value:
            _ = parse_memory(value)
        return value or None

    @field_validator("volumes")
    @classmethod
    def validate_volumes(cls, value: list[str]) -> list[str]:
        for volume in value:
            if len(volume.split(":")) not in (2, 3):
                raise ValueError(f"Invalid volume '{volume}', use source:target or source:target:ro")
        return value


# Add new provider configs to this union
WorkerProviderConfig = Annotated[KubernetesWorkerConfig | DockerWorkerConfig, Field(discriminator="provider")]


class WorkerTemplateResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    status: Literal[
        ModelStatus.DISABLED,
        ModelStatus.ENABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    provider: WorkerProviderType = Field(..., frozen=True)
    configuration: WorkerProviderConfig = Field(...)
    max_workers: int = Field(default=3)
    idle_timeout_seconds: int = Field(default=300)
    priority: int = Field(default=0)
    last_error: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "worker_template"


class WorkerTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    provider: WorkerProviderType = Field(..., frozen=True)
    configuration: WorkerProviderConfig = Field(...)
    max_workers: int = Field(default=3, ge=1)
    idle_timeout_seconds: int = Field(default=300, ge=30)
    priority: int = Field(default=0)
    labels: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def provider_matches_configuration(self):
        if self.configuration.provider != self.provider:
            raise ValueError("Configuration does not match the worker provider")
        return self


class WorkerTemplateUpdate(BaseModel):
    description: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    configuration: WorkerProviderConfig | None = Field(default=None)
    max_workers: int | None = Field(default=None, ge=1)
    idle_timeout_seconds: int | None = Field(default=None, ge=30)
    priority: int | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def at_least_one_field_present(cls, values):
        if not isinstance(values, dict):
            return values
        if not any(values.get(field) not in (None, [], "") for field in WorkerTemplateUpdate.model_fields):
            raise ValueError("At least one field must be provided in Worker template update.")
        return values
