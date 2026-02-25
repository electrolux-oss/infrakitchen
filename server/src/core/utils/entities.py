DEFAULT_ENTITIES = [
    "executor",
    "template",
    "resource",
    "resource_temp_state",
    "source_code",
    "source_code_version",
    "integration",
    "storage",
    "secret",
    "log",
    "audit_log",
    "task",
    "constant",
    "cloud_resource",
    "worker",
    "workspace",
    "entitie",
    "user",
    "permission",
    "variable",
    "validation_rule",
    "label",
    "tree",
    "schema",
]

ADMIN_ENTITIES = [
    "auth_provider",
]

INFRA_ENTITIES = [
    "template",
    "source_code",
    "source_code_version",
    "integration",
    "secret",
    "storage",
]


def get_all_entities():
    return DEFAULT_ENTITIES + ADMIN_ENTITIES
