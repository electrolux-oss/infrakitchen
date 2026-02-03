from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Self
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from application.templates.schema import TemplateShort
from application.source_codes.schema import SourceCodeShort
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class VariableModel(BaseModel):
    """
    Container for a single variable record.
    """

    name: str = Field(...)
    type: str = Field(default="any")
    original_type: str | None = Field(default=None)
    required: bool = Field(default=False)
    # default `None` actually has two meanings:
    # when `required` is True, it means `default` is not set
    # when `required` is False, it means the default value is `None` (null in Terraform)
    default: Any | None = Field(default=None)
    description: str = Field(default="")
    sensitive: bool = Field(default=False)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # if `default` is not set, then `required` should become True
        if "default" not in kwargs:
            self.required = True

    @classmethod
    def get_from_named_dict(cls, named_dict: dict[str, Any], name: str) -> "VariableModel":
        """
        Get the value from a named dictionary.
        Example:
            {'account': {'type': 'str'}, 'region': {'type': 'str', 'default': 'emea'}, 'name': {'type': 'str'}}
        """
        variable = named_dict[name]
        if "default" in variable:
            required = False
        else:
            required = True

        return cls(
            name=name,
            type=variable.get("type", "any"),
            original_type=variable.get("original_type", None),
            required=required,
            default=variable.get("default", None),
            sensitive=variable.get("sensitive", False),
            description=variable.get("description", ""),
        )


class OutputVariableModel(BaseModel):
    """
    Container for a single output record.
    """

    name: str = Field(...)
    value: Any | None = Field(...)
    description: str = Field(default="")

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @classmethod
    def get_from_named_dict(cls, named_dict: dict[str, Any], name: str) -> "OutputVariableModel":
        """
        Get the value from a named dictionary.
        Example:
            {'hello_world': {'value': 'Hello, World!'}}
        """
        variable = named_dict[name]
        return cls(name=name, value=variable.get("value"), description=variable.get("description", ""))


class VariableReferenceModel(BaseModel):
    """
    Container for a single variable reference record.
    Defines a reference to a output variable in another config
        if children has dependency on it.
    """

    # TODO: Varibles should not be None
    output_variable_id: OutputVariableModel | uuid.UUID | None = Field(default=None)
    source_code_version_id: uuid.UUID | None = Field(default=None)
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class VariableConfigModel(BaseModel):
    """
    Model representing the configuration of a variable.

    Attributes:
        title (str): The title of the variable.
        required (bool): Indicates if the variable is required.
        default (Any): The default value of the variable.
        frozen (bool): Indicates if the variable is frozen.
        unique (bool): Indicates if the variable is unique.
        sensitive (bool): Indicates if the variable is sensitive.
        description (str): The description of the variable.
        disabled (bool): Indicates if the variable is disabled and variable can not be modified by user.
        inherited (bool): Indicates if the variable is inherited output from parent resource.
        type (str): The type of the variable.
        options (list[str]): The list of options for the variable.
        referenced (VariableReferenceModel | None): The referenced variable, if any.
    """

    title: str = Field(..., frozen=True)
    required: bool = Field(default=False)
    default: Any = Field(default=None)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    sensitive: bool = Field(default=False)
    restricted: bool = Field(default=False)
    description: str = Field(default="")
    disabled: bool = Field(default=False)
    inherited: bool = Field(default=False)
    type: str = Field(default="any")
    options: list[str] = Field(default_factory=list)
    referenced: VariableReferenceModel | None = Field(default=None)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class SourceCodeVersionResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.READY,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.READY)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    template: TemplateShort = Field(...)
    source_code: SourceCodeShort = Field(...)
    source_code_version: str | None = Field(default=None, frozen=True)
    source_code_branch: str | None = Field(default=None, frozen=True)
    source_code_folder: str = Field(default="", frozen=True)
    variables: list[VariableModel] = Field(default_factory=list)
    outputs: list[OutputVariableModel] = Field(default_factory=list)
    description: str = Field(default="")
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def identifier(self) -> str:
        return f"{self.source_code_folder}:{self.source_code_version or self.source_code_branch}"

    @computed_field
    def _entity_name(self) -> str:
        return "source_code_version"


class SourceCodeVersionCreate(BaseModel):
    """
    Request model for creating a new source code version.
    """

    template_id: uuid.UUID = Field(..., frozen=True)
    source_code_id: uuid.UUID = Field(..., frozen=True)
    source_code_version: str | None = Field(default=None, frozen=True)
    source_code_branch: str | None = Field(default=None, frozen=True)
    source_code_folder: str = Field(default="", frozen=True)
    description: str = Field(default="")
    labels: list[str] = Field(default_factory=list)


class SourceCodeVersionVariablesCreate(SourceCodeVersionCreate):
    """
    Request model for creating a new source code version with variables.
    Used for generating fixtures
    """

    source_code_version_id: str | None = Field(default=None, frozen=True)
    variables: list[VariableModel] = Field(default_factory=list)
    outputs: list[OutputVariableModel] = Field(default_factory=list)
    variables_config: list[VariableConfigModel] = Field(default_factory=list)


class SourceCodeVersionUpdate(BaseModel):
    """
    Request model for updating an existing source code version.
    """

    description: str = Field(default="")
    labels: list[str] = Field(default_factory=list)


class SourceCodeVersionShort(BaseModel):
    id: uuid.UUID = Field(...)

    source_code_version: str | None = Field(default=None, frozen=True)
    source_code_branch: str | None = Field(default=None, frozen=True)
    source_code_folder: str = Field(default="", frozen=True)
    template: TemplateShort = Field(...)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def identifier(self) -> str:
        return f"{self.source_code_folder}:{self.source_code_version or self.source_code_branch}"

    @computed_field
    def _entity_name(self) -> str:
        return "source_code_version"


class SourceConfigShort(BaseModel):
    """
    Short representation of a source code version configuration.
    """

    id: uuid.UUID = Field(...)
    index: int = Field(default=0)
    name: str = Field(...)
    type: str = Field(...)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    sensitive: bool = Field(default=False)
    restricted: bool = Field(default=False)
    default: Any | None = Field(default=None)
    options: list[str] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class ConfigValidationModel(BaseModel):
    min_value: Decimal | None = Field(default=None)
    max_value: Decimal | None = Field(default=None)
    regex: str | None = Field(default=None)


class SourceConfigResponse(BaseModel):
    id: uuid.UUID = Field(...)
    index: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now, frozen=True)
    source_code_version_id: uuid.UUID = Field(...)
    required: bool = Field(default=False)
    sensitive: bool = Field(default=False)
    restricted: bool = Field(default=False)
    default: Any | None = Field(default=None)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    name: str = Field(...)
    description: str = Field(...)
    type: str = Field(...)
    options: list[str] = Field(default_factory=list)
    validation: ConfigValidationModel | None = Field(default=None)
    model_config = ConfigDict(from_attributes=True)


class SourceConfigCreate(BaseModel):
    """
    Request model for creating a new source code version configuration.
    """

    index: int = Field(default=0)
    source_code_version_id: uuid.UUID = Field(...)
    required: bool = Field(default=False)
    default: Any | None = Field(default=None)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    sensitive: bool = Field(default=False)
    restricted: bool = Field(default=False)
    name: str = Field(...)
    description: str = Field(...)
    type: str = Field(...)
    options: list[str] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class SourceConfigUpdate(BaseModel):
    """
    Request model for updating an existing source code version configuration.
    """

    required: bool = Field(default=False)
    default: Any | None = Field(default=None)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    restricted: bool = Field(default=False)
    options: list[str] = Field(default_factory=list)


class SourceConfigUpdateWithId(BaseModel):
    """
    Request model for bulk updating source code version configurations.
    Includes the ID to identify which config to update.
    """

    id: uuid.UUID = Field(title="Config ID")

    required: bool = Field(default=False)
    default: Any | None = Field(default=None)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    restricted: bool = Field(default=False)
    options: list[str] = Field(default_factory=list)
    template_id: uuid.UUID = Field(...)
    reference_template_id: uuid.UUID | None = Field(default=None)
    output_config_name: str | None = Field(default=None)
    validation: ConfigValidationModel | None = Field(default=None)


class SourceOutputConfigResponse(BaseModel):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    index: int = Field(default=0)
    source_code_version_id: uuid.UUID = Field(...)
    name: str = Field(...)
    description: str = Field(...)
    model_config = ConfigDict(from_attributes=True)


class SourceOutputConfigTemplateResponse(BaseModel):
    name: str = Field(...)
    description: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        "active",
        "deleted",
        "new",
    ] = Field(default="active")


class SourceOutputConfigShort(BaseModel):
    """
    Short representation of a source code version output configuration.
    """

    id: uuid.UUID = Field(...)
    index: int = Field(default=0)
    name: str = Field(...)
    description: str = Field(...)
    source_code_version_id: uuid.UUID = Field(...)
    model_config = ConfigDict(from_attributes=True)


class SourceOutputConfigCreate(BaseModel):
    """
    Request model for creating a new source code version configuration.
    """

    index: int = Field(default=0)
    source_code_version_id: uuid.UUID = Field(...)
    name: str = Field(...)
    description: str = Field(...)
    model_config = ConfigDict(from_attributes=True)


class SourceConfigTemplateReferenceResponse(BaseModel):
    id: uuid.UUID = Field(...)
    template_id: uuid.UUID = Field(...)
    reference_template_id: uuid.UUID = Field(...)
    input_config_name: str = Field(...)
    output_config_name: str = Field(...)

    model_config = ConfigDict(from_attributes=True)


class SourceConfigTemplateReferenceCreate(BaseModel):
    template_id: uuid.UUID = Field(...)
    reference_template_id: uuid.UUID | None = Field(default=None)
    input_config_name: str = Field(...)
    output_config_name: str | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def validate_templates(self) -> Self:
        if self.template_id == self.reference_template_id:
            raise ValueError("template_id and reference_template_id cannot be the same")
        return self


class SourceCodeVersionWithConfigs(SourceCodeVersionResponse):
    """
    Model representing a source code version with its configurations.
    """

    variable_configs: list[SourceConfigResponse] = Field(default_factory=list)
    output_configs: list[SourceOutputConfigResponse] = Field(default_factory=list)
    template_refs: list[SourceConfigTemplateReferenceResponse] = Field(default_factory=list)
