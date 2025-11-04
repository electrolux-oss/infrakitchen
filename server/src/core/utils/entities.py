INFRA_ENTITIES = [
    "template",
    "resource",
    "resource_temp_state",
    "source_code",
    "source_code_version",
    "integration",
    "storage",
    "log",
    "task",
    "constant",
    "cloud_resource",
    "worker",
    "workspace",
]

ADMIN_ENTITIES = [
    "auth_provider",
    "user",
    "permission",
]


def get_all_entities():
    return INFRA_ENTITIES + ADMIN_ENTITIES


def get_infra_entities():
    return INFRA_ENTITIES
