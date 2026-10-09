from datetime import datetime
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from application.integrations.schema import IntegrationShort
from application.storages.schema import StorageShort
from core.constants.model import ModelStatus
from core.tools.schema import ToolShort
from core.users.schema import UserShort

from .model import DEFAULT_STATE_PATH_TEMPLATE

_SHA = re.compile(r"^[0-9a-f]{7,40}$")
_REGION = re.compile(r"^[a-z0-9-]+$")
_VARIABLE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_state_path_template(value: str | None) -> str | None:
    if value is None:
        return value
    value = value.strip()
    if not value:
        raise ValueError("State path template must not be empty")
    try:
        _ = value.format(module="m", module_name="m", env="e", region="r")
    except (KeyError, IndexError, ValueError) as e:
        raise ValueError("State path template may only use {module}, {module_name}, {env} and {region}") from e
    return value


def _validate_regions(value: list[str] | None) -> list[str] | None:
    if value is None:
        return value
    regions = [region.strip() for region in value if region.strip()]
    for region in regions:
        if not _REGION.match(region):
            raise ValueError(f"Invalid region: {region}")
    return list(dict.fromkeys(regions))


def _validate_region_variable(value: str | None) -> str | None:
    # An empty string clears it on update.
    if value is None or value.strip() == "":
        return value if value is None else ""
    value = value.strip()
    if not _VARIABLE.match(value):
        raise ValueError("Region variable must be a valid variable name")
    return value


def _validate_variables(value: dict[str, str] | None) -> dict[str, str] | None:
    if value is None:
        return value
    variables = {name.strip(): str(val) for name, val in value.items()}
    for name in variables:
        if not _VARIABLE.match(name):
            raise ValueError(f"Invalid variable name: {name}")
    return variables


def _validate_region_variables(value: dict[str, dict[str, str]] | None) -> dict[str, dict[str, str]] | None:
    if value is None:
        return value
    region_variables: dict[str, dict[str, str]] = {}
    for region, variables in value.items():
        region = region.strip()
        if not _REGION.match(region):
            raise ValueError(f"Invalid region: {region}")
        checked = _validate_variables(variables) or {}
        if checked:
            region_variables[region] = checked
    return region_variables


class IacEnvironmentConfigCreate(BaseModel):
    name: str = Field(..., min_length=1)
    integration_ids: list[uuid.UUID] = Field(default_factory=list)
    storage_id: uuid.UUID | None = Field(default=None)
    state_path_template: str = Field(default=DEFAULT_STATE_PATH_TEMPLATE)
    tool_id: uuid.UUID | None = Field(default=None)
    regions: list[str] = Field(default_factory=list)
    region_variable: str | None = Field(default=None)
    variables: dict[str, str] = Field(default_factory=dict)
    region_variables: dict[str, dict[str, str]] = Field(default_factory=dict)

    _check_state_path_template = field_validator("state_path_template")(_validate_state_path_template)
    _check_regions = field_validator("regions")(_validate_regions)
    _check_region_variable = field_validator("region_variable")(_validate_region_variable)
    _check_variables = field_validator("variables")(_validate_variables)
    _check_region_variables = field_validator("region_variables")(_validate_region_variables)


class IacEnvironmentConfigUpdate(BaseModel):
    integration_ids: list[uuid.UUID] | None = Field(default=None)
    storage_id: uuid.UUID | None = Field(default=None)
    # Set to true to use the module's own backend block again.
    clear_storage: bool = Field(default=False)
    state_path_template: str | None = Field(default=None)
    tool_id: uuid.UUID | None = Field(default=None)
    # Set to true to use the default tofu version again.
    clear_tool: bool = Field(default=False)
    regions: list[str] | None = Field(default=None)
    # An empty string clears it.
    region_variable: str | None = Field(default=None)
    variables: dict[str, str] | None = Field(default=None)
    region_variables: dict[str, dict[str, str]] | None = Field(default=None)

    _check_state_path_template = field_validator("state_path_template")(_validate_state_path_template)
    _check_regions = field_validator("regions")(_validate_regions)
    _check_region_variable = field_validator("region_variable")(_validate_region_variable)
    _check_variables = field_validator("variables")(_validate_variables)
    _check_region_variables = field_validator("region_variables")(_validate_region_variables)


class IacEnvironmentConfigResponse(BaseModel):
    id: uuid.UUID
    source_code_id: uuid.UUID
    name: str
    integrations: list[IntegrationShort] = Field(default_factory=list)
    storage: StorageShort | None = Field(default=None)
    state_path_template: str
    tool: ToolShort | None = Field(default=None)
    regions: list[str] = Field(default_factory=list)
    region_variable: str | None = Field(default=None)
    variables: dict[str, str] = Field(default_factory=dict)
    region_variables: dict[str, dict[str, str]] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IacPlanCreate(BaseModel):
    module_path: str
    environment_name: str
    # Required when the environment is deployed to regions.
    region: str | None = Field(default=None)
    # Branch or tag to plan; the default branch when neither this nor sha is given.
    ref: str | None = Field(default=None)
    # A commit picked from the history.
    sha: str | None = Field(default=None)

    @field_validator("sha")
    @classmethod
    def _check_sha(cls, value: str | None) -> str | None:
        if value is not None and not _SHA.match(value):
            raise ValueError("Commit must be a hexadecimal SHA")
        return value


class IacRunResponse(BaseModel):
    id: uuid.UUID
    source_code_id: uuid.UUID
    module_path: str
    environment_name: str
    region: str | None = Field(default=None)
    action: str
    ref: str | None = Field(default=None)
    sha: str | None = Field(default=None)
    status: ModelStatus
    to_add: int | None = Field(default=None)
    to_change: int | None = Field(default=None)
    to_destroy: int | None = Field(default=None)
    creator: UserShort | None = Field(default=None)
    created_at: datetime
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "iac_run"
