from typing import Any, TypeVar
import uuid


from pydantic import BaseModel as PydanticBaseModel, HttpUrl
from ..models.encrypted_secret import EncryptedSecretStr


TPydanticBaseModel = TypeVar("TPydanticBaseModel", bound=PydanticBaseModel)


def is_valid_uuid(value: Any) -> bool:
    if value is None:
        return False
    try:
        if isinstance(value, uuid.UUID):
            return True
        _ = uuid.UUID(value)
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def valid_uuid(value: Any) -> uuid.UUID:
    if value is None:
        raise ValueError("UUID value cannot be None")
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(value)


def to_json_serializable(obj: Any) -> Any:
    """
    Recursively convert EncryptedSecretStr fields to plain strings.

    Args:
        data: The data to convert.

    Returns:
        The converted data.
    """
    if isinstance(obj, dict):
        return {k: to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_json_serializable(item) for item in obj]
    elif isinstance(obj, EncryptedSecretStr):
        return obj.get_secret_value()
    elif isinstance(obj, HttpUrl):
        return str(obj)
    else:
        return obj


def model_db_dump[TPydanticBaseModel: PydanticBaseModel](
    model: TPydanticBaseModel, exclude_fields=None, exclude_defaults=False, exclude_none=False, **kwargs
) -> dict[str, Any]:
    """
    Dump the model's data into a dictionary suitable for database storage.
    Exclude unset fields to avoid changing the existing values without validation.

    Args:
        model (TPydanticBaseModel): The Pydantic model instance to dump.
        exclude_fields (set[str], optional): A set of field names to exclude from the dump.
        kwargs: Additional keyword arguments to pass to the model_dump method.

    Returns:
        dict[str, Any]: A dictionary containing the mongo model's data.
    """
    if exclude_fields is None:
        exclude_fields = {"_entity_name"}

    self_dict = model.model_dump(
        by_alias=True, exclude=exclude_fields, exclude_defaults=exclude_defaults, exclude_none=exclude_none, **kwargs
    )
    return to_json_serializable(self_dict)


def has_field_changes(
    update_body: dict[str, Any],
    existing: Any,
) -> bool:
    """
    Determine whether an update payload would actually change an existing record.

    Args:
        update_body: Mapping of field name to new value (e.g. the result of
            ``model_db_dump`` with ``exclude_defaults``/``exclude_none``).
        existing: The current ORM object (or any object exposing the fields as
            attributes) to compare against.

    Returns:
        ``True`` if at least one provided field differs from the existing record.
    """

    for key, new_value in update_body.items():
        current_value = getattr(existing, key)

        if new_value != current_value:
            return True

    return False
