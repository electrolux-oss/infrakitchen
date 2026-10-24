import time
from collections import deque


class SlidingWindowLimiter:
    """In-process sliding-window counter keyed by an arbitrary string.

    State lives in the API process, so each replica keeps its own count. That
    is enough to make online guessing impractical without a shared store.
    """

    def __init__(self, max_hits: int, window_seconds: float, max_keys: int = 10_000) -> None:
        self.max_hits = max_hits
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}

    def _prune(self, key: str, now: float) -> deque[float] | None:
        hits = self._hits.get(key)
        if hits is None:
            return None
        while hits and hits[0] <= now - self.window_seconds:
            _ = hits.popleft()
        if not hits:
            del self._hits[key]
            return None
        return hits

    def is_limited(self, key: str) -> bool:
        hits = self._prune(key, time.monotonic())
        return hits is not None and len(hits) >= self.max_hits

    def hit(self, key: str) -> None:
        now = time.monotonic()
        hits = self._prune(key, now)
        if hits is None:
            if len(self._hits) >= self.max_keys:
                # Bound memory under a flood of distinct keys: drop the oldest tracked key
                del self._hits[next(iter(self._hits))]
            hits = self._hits[key] = deque()
        hits.append(now)

    def reset(self, key: str) -> None:
        _ = self._hits.pop(key, None)
