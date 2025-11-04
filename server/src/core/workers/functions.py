import platform


def get_host_metadata():
    stats = {
        "machine": platform.machine(),
        "node": platform.node(),
        "platform": platform.platform(),
        "processor": platform.processor(),
        "system": platform.system(),
        "version": platform.version(),
        "python": platform.python_version(),
    }

    if stats.get("system") == "Linux":
        with open("/proc/meminfo") as f:
            lines = f.readlines()

        for line in range(5):
            key, value = lines[line].split(":")
            stats[key] = value.strip()

    return stats
