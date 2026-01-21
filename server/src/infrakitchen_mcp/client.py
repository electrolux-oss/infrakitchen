from pathlib import Path
from typing import Any

from fastapi import FastAPI
import httpx
from .context import request_auth_token


class DocsProvider:
    """Handles documentation file access with path security."""

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir.resolve()
        self._files: dict[str, str] = {}
        self._load_files()

    def _load_files(self) -> None:
        """Load all non-empty markdown files into memory."""
        for path in self.base_dir.rglob("*.md"):
            if not path.is_file():
                continue
            content = path.read_text(encoding="utf-8").strip()
            if not content:
                continue
            rel_path = path.relative_to(self.base_dir).as_posix()
            self._files[rel_path] = content

    def _validate_path(self, file_path: str) -> None:
        """Validate path is safe and exists."""
        full_path = (self.base_dir / file_path).resolve()
        if not full_path.is_relative_to(self.base_dir):
            raise ValueError(f"Access denied: {file_path} is outside docs directory")
        if file_path not in self._files:
            raise FileNotFoundError(f"Doc not found: {file_path}")

    def read_file(self, file_path: str) -> str:
        self._validate_path(file_path)
        return self._files[file_path]

    def list_files(self, query: str | None = None) -> list[str]:
        files = list(self._files.keys())
        if query:
            files = [f for f in files if query.lower() in f.lower()]
        return sorted(files)


class InternalAPIClient:
    """HTTP client for internal FastAPI communication."""

    def __init__(self, app: FastAPI, api_prefix: str = "/api"):
        self._http_client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://internal"
        )
        self._api_prefix = api_prefix

    async def get(self, path: str, **query_params) -> Any:
        filtered_params = {k: v for k, v in query_params.items() if v is not None}

        headers = {}
        if token := request_auth_token.get():
            headers["Authorization"] = token

        response = await self._http_client.get(
            f"{self._api_prefix}/{path.lstrip('/')}", params=filtered_params, headers=headers
        )

        if response.status_code == 404:
            return {"error": "not_found", "path": path}
        if response.status_code >= 400:
            return {"error": response.status_code, "detail": response.text}

        try:
            return response.json()
        except Exception:
            return {"error": "invalid_json", "content": response.text}
