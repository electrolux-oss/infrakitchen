from typing import Any


class BusinessLogicError(Exception):
    """
    Custom exception class to be raised when a known business rule is violated.
    It carries an internal error code, and optional metadata.
    """

    def __init__(self, message: str, error_code: str = "GENERIC_ERROR", metadata: dict[str, Any] | None = None):
        self.message = message
        self.error_code = error_code
        self.metadata = metadata if metadata is not None else {}
        super().__init__(self.message)


class DependencyError(Exception):
    """Raised when a dependency is not met"""

    def __init__(self, message: str, metadata: list[dict[str, Any]] | None = None):
        self.message = message
        self.error_code = "DEPENDENCY_ERROR"
        self.metadata = metadata if metadata is not None else []
        super().__init__(self.message)


class EntityExistsError(Exception):
    """Raised when an object already exists in the database"""

    pass


class ParentIsNotReady(Exception):
    pass


class ChildrenIsNotReady(Exception):
    pass


class EntityNotFound(Exception):
    pass


class CannotProceed(Exception):
    """Raised when a task cannot proceed due to some reason. e.g. dependencies are not ready"""

    pass


class EntityValueError(Exception):
    pass


class AccessUnauthorized(Exception):
    pass


class TaskFailure(Exception):
    pass


class ShellExecutionError(Exception):
    pass


class AccessDenied(Exception):
    pass


class ConfigError(Exception):
    pass


class CloudExecutionError(Exception):
    pass


class CloudWrongCredentials(Exception):
    def __init__(self, message: str, metadata: list[dict[str, Any]] | None = None):
        self.message = message
        self.error_code = "CREDENTIALS_ERROR"
        self.metadata = metadata if metadata is not None else []
        super().__init__(self.message)


class EntityWrongState(Exception):
    pass


class ExitWithoutSave(Exception):
    pass
