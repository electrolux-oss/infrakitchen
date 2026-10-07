import aiofiles
import platform


async def get_host_metadata():
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
        async with aiofiles.open("/proc/meminfo") as f:
            lines = await f.readlines()

        for line in range(5):
            key, value = lines[line].split(":")
            stats[key] = value.strip()

    return stats
