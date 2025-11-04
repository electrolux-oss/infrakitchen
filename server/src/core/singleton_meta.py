from typing import override


class SingletonMeta(type):
    _instances: dict[type, type] = {}

    @override
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            instance = super().__call__(*args, **kwargs)
            cls._instances[cls] = instance
        return cls._instances[cls]
