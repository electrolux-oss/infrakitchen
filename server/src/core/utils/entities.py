INFRA_ENTITIES = [
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
    "label",
    "tree",
    "schema",
]

ADMIN_ENTITIES = [
    "auth_provider",
]


def get_all_entities():
    return INFRA_ENTITIES + ADMIN_ENTITIES


def get_infra_entities():
    return INFRA_ENTITIES
