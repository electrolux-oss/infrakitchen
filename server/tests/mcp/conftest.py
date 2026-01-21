from infrakitchen_mcp.client import DocsProvider
from infrakitchen_mcp.server import DEFAULT_DOCS_DIR
import pytest
from pathlib import Path
from fastapi import FastAPI, Header
from fastapi.responses import JSONResponse


from src.app import app as real_app


@pytest.fixture
def real_fastapi_app() -> FastAPI:
    """The actual FastAPI application for endpoint validation."""
    return real_app


@pytest.fixture
def docs_provider() -> DocsProvider:
    """Provider pointing to actual docs directory."""
    return DocsProvider(DEFAULT_DOCS_DIR)


@pytest.fixture
def temp_docs_provider(tmp_path: Path) -> DocsProvider:
    """Provider with temporary docs for isolation tests."""
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "README.md").write_text("# Test README")
    (docs / "guide.md").write_text("# Guide")

    subdir = docs / "api"
    subdir.mkdir()
    (subdir / "endpoints.md").write_text("# Endpoints")

    return DocsProvider(docs)


@pytest.fixture
def fastapi_app() -> FastAPI:
    """FastAPI app for testing API client."""
    app = FastAPI()

    @app.get("/api/workspaces")
    async def list_workspaces(authorization: str | None = Header(None)):
        if not authorization:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        return [{"id": "ws-1", "name": "Test"}]

    @app.get("/api/workspaces/{id}")
    async def get_workspace(id: str):
        return {"id": id, "name": "Test"}

    @app.get("/api/auth-check")
    async def auth_check(authorization: str | None = Header(None)):
        return {"has_auth": authorization is not None, "auth_value": authorization}

    return app
