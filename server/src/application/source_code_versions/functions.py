from typing import Any


def verify_config_type(config: dict[str, Any], expected_type: str) -> None:
    """
    Verify that the config dictionary has the expected type.

    Args:
        config (dict[str, Any]): The configuration dictionary to verify.
        expected_type (str): The expected type of the configuration.
    """
    if not config.get("default"):
        return

    match expected_type:
        case "number":
            config["default"] = int(config["default"])
        case "boolean":
            config["default"] = bool(config["default"])
        case "string":
            config["default"] = str(config["default"])
        case _:
            pass
